import axios from "axios";
import type {
  Plan,
  ConfirmPlanPayload,
  DailyPlansResponse,
  WeeklyPlansResponse,
  StoreWeekResponse,
  JudgementPayload,
  DailyPlanBase,
  Ingredient,
  Recipe,
  CreateRecipePayload,
  UpdateRecipePayload,
  RecipeUpdateResult,
  CountsResponse,
  IngredientKey,
} from "@/types/dough-sauce.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Errors                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/** Which of the three backends a call went to — contract §1. */
export type DoughSauceSystem = "audit" | "data" | "inv";

export type DoughSauceErrorCode =
  | "NOT_AUTHENTICATED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN";

export class DoughSauceError extends Error {
  readonly code: DoughSauceErrorCode;
  readonly system: DoughSauceSystem;
  readonly status?: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    code: DoughSauceErrorCode,
    system: DoughSauceSystem,
    status?: number,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "DoughSauceError";
    this.code = code;
    this.system = system;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  get retryable() {
    return this.code === "TIMEOUT" || this.code === "NETWORK_ERROR" || this.code === "SERVER_ERROR";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth-token");
  if (!raw) return null;
  try {
    return JSON.parse(raw)?.state?.token ?? null;
  } catch {
    return null;
  }
}

function authHeaders(system: DoughSauceSystem): Record<string, string> {
  const token = getToken();
  if (!token) {
    throw new DoughSauceError("You must be logged in.", "NOT_AUTHENTICATED", system, 401);
  }
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

function toError(err: unknown, system: DoughSauceSystem): DoughSauceError {
  if (err instanceof DoughSauceError) return err;
  if (axios.isCancel(err)) throw err;

  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    // Two envelopes reach us: our proxy's `{ success:false, error:{…} }` for
    // audit/data, and the inventory backend's own `{ message, errors }`,
    // which proxyInventory mirrors verbatim.
    const data = err.response?.data as
      | {
          error?: { message?: string; details?: { upstream?: { message?: string; errors?: Record<string, string[]> } } };
          message?: string;
          errors?: Record<string, string[]>;
        }
      | undefined;
    const upstream = data?.error?.details?.upstream;
    const message = upstream?.message || data?.error?.message || data?.message;
    const fieldErrors = upstream?.errors ?? data?.errors;

    if (status === 401) return new DoughSauceError(message || "Authentication failed.", "UNAUTHORIZED", system, 401);
    if (status === 403)
      return new DoughSauceError(message || "You don't have permission to do this.", "FORBIDDEN", system, 403);
    if (status === 404) return new DoughSauceError(message || "Not found.", "NOT_FOUND", system, 404);
    if (status === 422)
      return new DoughSauceError(message || "Some fields are invalid.", "VALIDATION_ERROR", system, 422, fieldErrors);
    if (status === 429) return new DoughSauceError(message || "Too many requests.", "RATE_LIMITED", system, 429);
    if (status === 504 || err.code === "ECONNABORTED")
      return new DoughSauceError("Request timed out.", "TIMEOUT", system, status);
    if (!err.response || err.code === "ERR_NETWORK")
      return new DoughSauceError("Unable to connect.", "NETWORK_ERROR", system);
    if (status && status >= 500)
      return new DoughSauceError(message || "The server encountered an error.", "SERVER_ERROR", system, status);
    return new DoughSauceError(message || "Something went wrong.", "UNKNOWN", system, status);
  }
  return new DoughSauceError("An unexpected error occurred.", "UNKNOWN", system);
}

async function call<T>(
  system: DoughSauceSystem,
  config: { method: "GET" | "POST" | "PUT" | "DELETE"; url: string; params?: Record<string, unknown>; data?: unknown },
  signal?: AbortSignal
): Promise<T> {
  try {
    const res = await axios.request<T>({
      ...config,
      headers: authHeaders(system),
      timeout: 30_000,
      signal,
    });
    return res.data;
  } catch (err) {
    throw toError(err, system);
  }
}

/** Rule 3 — booleans in a query string are words. */
const boolParam = (b: boolean) => (b ? "true" : "false");

const storePath = (storeKey: string) => `/api/dough-sauce/stores/${encodeURIComponent(storeKey)}`;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Recipe list normalisation                                                 */
/*                                                                            */
/*  The contract shows the POST body but not the GET row shape. Accept both a */
/*  flat row-per-ingredient list and an item-with-lines list, and flatten to  */
/*  one row per (item, ingredient) — which is what PUT/DELETE address.        */
/* ────────────────────────────────────────────────────────────────────────── */

type RawRecipe = Partial<Recipe> & {
  menu_item?: { item_id?: string; name?: string; account?: string } | null;
  lines?: (Partial<Recipe> & { ingredient_key: IngredientKey })[];
};

function flattenRecipes(body: unknown): Recipe[] {
  const b = body as { recipes?: RawRecipe[]; data?: RawRecipe[] | { recipes?: RawRecipe[] } } | RawRecipe[];
  const list: RawRecipe[] = Array.isArray(b)
    ? b
    : Array.isArray(b?.recipes)
      ? b.recipes
      : Array.isArray(b?.data)
        ? b.data
        : ((b?.data as { recipes?: RawRecipe[] } | undefined)?.recipes ?? []);

  const out: Recipe[] = [];
  for (const r of list) {
    const item_id = String(r.item_id ?? r.menu_item?.item_id ?? "");
    const menu_item_name = r.menu_item_name ?? r.menu_item?.name ?? null;
    const menu_item_account = r.menu_item_account ?? r.menu_item?.account ?? null;
    const rows = r.lines?.length ? r.lines.map((l) => ({ ...r, ...l })) : [r];
    for (const row of rows) {
      if (row.id == null || !row.ingredient_key) continue;
      out.push({
        id: Number(row.id),
        item_id,
        menu_item_name,
        menu_item_account,
        ingredient_key: row.ingredient_key,
        qty: Number(row.qty ?? 0),
        effective_from: row.effective_from ?? "",
        effective_to: row.effective_to ?? null,
      });
    }
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export const doughSauceService = {
  /* ── audit ── */

  /** §3.1 — `date` omitted → tomorrow. */
  async getPlan(storeKey: string, date?: string, signal?: AbortSignal): Promise<Plan> {
    const res = await call<{ data: Plan }>(
      "audit",
      { method: "GET", url: `${storePath(storeKey)}/plan`, params: date ? { date } : undefined },
      signal
    );
    return res.data;
  },

  /** §3.2 — all three lines or none; re-posting the same date updates it. */
  async confirmPlan(storeKey: string, payload: ConfirmPlanPayload): Promise<Plan> {
    const res = await call<{ data: Plan }>("audit", {
      method: "POST",
      url: `${storePath(storeKey)}/plan`,
      data: payload,
    });
    return res.data;
  },

  /** §3.3 daily shape. */
  getDailyPlans(date?: string, signal?: AbortSignal): Promise<DailyPlansResponse> {
    return call("audit", { method: "GET", url: "/api/dough-sauce/plans", params: date ? { date } : undefined }, signal);
  },

  /** §3.3 weekly shape — `week_start` must come from a `weeks` list. */
  getWeeklyPlans(weekStart?: string, signal?: AbortSignal): Promise<WeeklyPlansResponse> {
    return call(
      "audit",
      { method: "GET", url: "/api/dough-sauce/plans", params: weekStart ? { week_start: weekStart } : undefined },
      signal
    );
  },

  /** §3.4 */
  getStoreWeek(storeKey: string, weekStart?: string, signal?: AbortSignal): Promise<StoreWeekResponse> {
    return call(
      "audit",
      { method: "GET", url: `${storePath(storeKey)}/week`, params: weekStart ? { week_start: weekStart } : undefined },
      signal
    );
  },

  /** §3.5 */
  saveJudgement(storeKey: string, payload: JudgementPayload): Promise<unknown> {
    return call("audit", { method: "PUT", url: `${storePath(storeKey)}/judgement`, data: payload });
  },

  /* ── data ── */

  /** §4.1 — `date` is the PRODUCTION date (required). */
  getDailyPlanBase(
    storeKey: string,
    date: string,
    opts: { lookback?: number; includeRefunded?: boolean } = {},
    signal?: AbortSignal
  ): Promise<DailyPlanBase> {
    return call(
      "data",
      {
        method: "GET",
        url: `${storePath(storeKey)}/daily-plan`,
        params: {
          date,
          ...(opts.lookback && { lookback: opts.lookback }),
          include_refunded: boolParam(opts.includeRefunded ?? false),
        },
      },
      signal
    );
  },

  async getIngredients(signal?: AbortSignal): Promise<Ingredient[]> {
    const res = await call<{ ingredients?: Ingredient[]; data?: Ingredient[] }>(
      "data",
      { method: "GET", url: "/api/dough-sauce/ingredients" },
      signal
    );
    return res.ingredients ?? res.data ?? [];
  },

  async getRecipes(
    opts: { itemId?: string; asOf?: string; all?: boolean } = {},
    signal?: AbortSignal
  ): Promise<Recipe[]> {
    const res = await call<unknown>(
      "data",
      {
        method: "GET",
        url: "/api/dough-sauce/recipes",
        params: {
          ...(opts.itemId && { item_id: opts.itemId }),
          ...(opts.asOf && { as_of: opts.asOf }),
          ...(opts.all && { all: boolParam(true) }),
        },
      },
      signal
    );
    return flattenRecipes(res);
  },

  createRecipe(payload: CreateRecipePayload): Promise<unknown> {
    return call("data", { method: "POST", url: "/api/dough-sauce/recipes", data: payload });
  },

  updateRecipe(id: number, payload: UpdateRecipePayload): Promise<RecipeUpdateResult> {
    return call("data", { method: "PUT", url: `/api/dough-sauce/recipes/${id}`, data: payload });
  },

  closeRecipe(id: number): Promise<{ effective_to?: string }> {
    return call("data", { method: "DELETE", url: `/api/dough-sauce/recipes/${id}` });
  },

  /* ── inv ── */

  /** §5 — one store per call, range ≤ 31 days. */
  getCounts(
    storeKey: string,
    dateFrom: string,
    dateTo: string,
    ultimatrixIds: string[],
    signal?: AbortSignal
  ): Promise<CountsResponse> {
    return call(
      "inv",
      {
        method: "GET",
        url: `/api/inventory/stores/${encodeURIComponent(storeKey)}/counts`,
        params: { date_from: dateFrom, date_to: dateTo, ultimatrix_ids: ultimatrixIds.join(",") },
      },
      signal
    );
  },

  /**
   * One call for EVERY active store — the weekly grid's counts. No store
   * parameter; a specialist gets 200, a store manager 403 (use `getCounts`).
   * `include_missing=false`: the grid derives gaps itself from the plans, and
   * across 44 stores the server's gap list is most of the payload. Range ≤ 31 days.
   */
  getAllCounts(
    dateFrom: string,
    dateTo: string,
    ultimatrixIds: string[],
    signal?: AbortSignal
  ): Promise<CountsResponse> {
    return call(
      "inv",
      {
        method: "GET",
        url: "/api/inventory/counts",
        // Rule 3 — booleans in a query string are words.
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          ultimatrix_ids: ultimatrixIds.join(","),
          include_missing: boolParam(false),
        },
      },
      signal
    );
  },
};
