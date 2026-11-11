import axios from "axios";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";
import { schedulingService } from "@/lib/api/services/scheduling.service";
import { daysToInstants } from "@/lib/maintenance-tickets/local-range";
import type { AnalyticsSummary } from "@/types/maintenance-analytics.types";
import type { StoreSkillsOverview } from "@/types/skills.types";
import type { SalesHistory } from "@/types/dashboard-report.types";
import type {
  BusinessReportsParams,
  DebriefsSection,
  LaborReport,
  MenuSection,
  OperationsSection,
  OrdersSection,
  PayrollWeeks,
  QualitySection,
  SalesSection,
  StoreScoreSection,
  WbrBulkResponse,
} from "@/types/business-reports.types";

const MS_PER_SECOND = 1000;
/** A little over the proxies' own 5-minute wait, so the server answers first. */
const CLIENT_TIMEOUT_SECONDS = 310;
const CLIENT_TIMEOUT_MS = CLIENT_TIMEOUT_SECONDS * MS_PER_SECOND;

/**
 * The store score is computed per store and per week, so it is asked for in
 * batches of stores that run side by side: each request stays short and the
 * grid fills in as batches land. (A batch size, not a cap — every store is
 * scored.)
 */
const STORE_SCORE_BATCH = 25;
const STORE_SCORE_PARALLEL = 4;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth-token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function buildHeaders() {
  const token = getToken();
  if (!token) throw new Error("Not logged in.");
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

function body(params: BusinessReportsParams) {
  return { start_date: params.startDate, end_date: params.endDate, stores: params.stores };
}

function query(params: BusinessReportsParams): string {
  return new URLSearchParams([
    ["start_date", params.startDate],
    ["end_date", params.endDate],
    ...params.stores.map((store): [string, string] => ["stores[]", store]),
  ]).toString();
}

/**
 * At most this many Business Reports requests in flight at once, across every
 * service: they all share one MySQL server with few connections, so a page
 * load must never open a burst of them. The rest wait their turn, in the order
 * they were asked for.
 */
const MAX_IN_FLIGHT = 3;
let inFlight = 0;
const waiting: Array<() => void> = [];

async function limited<T>(run: () => Promise<T>): Promise<T> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight += 1;
  } else {
    // The slot is handed over directly when a running request ends.
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  try {
    return await run();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else inFlight -= 1;
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const { data } = await limited(() =>
    axios.get<T>(url, { headers: buildHeaders(), timeout: CLIENT_TIMEOUT_MS, signal }),
  );
  return data;
}

async function postSection<T>(
  section: string,
  params: BusinessReportsParams,
  signal?: AbortSignal,
  extra: Record<string, string> = {},
): Promise<T> {
  const { data } = await limited(() =>
    axios.post<T>(`/api/reports/business/${section}`, { ...body(params), ...extra }, {
      headers: buildHeaders(),
      timeout: CLIENT_TIMEOUT_MS,
      signal,
    }),
  );
  return data;
}

const ORDER_PARTS = ["channels", "important_items_hnr", "upselling", "promo"] as const;

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
}

export const businessReportsService = {
  getSales: (p: BusinessReportsParams, s?: AbortSignal) => postSection<SalesSection>("sales", p, s),
  getOperations: (p: BusinessReportsParams, s?: AbortSignal) =>
    postSection<OperationsSection>("operations", p, s),
  getMenu: (p: BusinessReportsParams, s?: AbortSignal) => postSection<MenuSection>("menu", p, s),
  /**
   * The orders section is four big reads, asked for as four requests (Data's
   * `part`) so each one is short and they share the in-flight limit with the
   * rest of the page instead of one long request.
   */
  async getOrders(p: BusinessReportsParams, s?: AbortSignal): Promise<OrdersSection> {
    const parts = await Promise.all(
      ORDER_PARTS.map((part) => postSection<Partial<OrdersSection>>("orders", p, s, { part })),
    );
    return Object.assign({}, ...parts) as OrdersSection;
  },
  getQuality: (p: BusinessReportsParams, s?: AbortSignal) => postSection<QualitySection>("quality", p, s),
  getDebriefs: (p: BusinessReportsParams, s?: AbortSignal) =>
    postSection<DebriefsSection>("debriefs", p, s),
  /** All-time weekly sales of the stores (the range is ignored, as on V1). */
  getSalesHistory: (p: BusinessReportsParams, s?: AbortSignal) =>
    postSection<SalesHistory>("sales-history", p, s),

  /** Store score in store batches; `onBatch` gets the merged result after each one lands. */
  async getStoreScore(
    params: BusinessReportsParams,
    signal?: AbortSignal,
    onBatch?: (partial: StoreScoreSection) => void,
  ): Promise<StoreScoreSection> {
    const batches = chunk(params.stores, STORE_SCORE_BATCH);
    let merged: StoreScoreSection | null = null;
    let next = 0;

    const absorb = (part: StoreScoreSection): void => {
      merged = merged
        ? { ...merged, by_store: { ...merged.by_store, ...part.by_store } }
        : { ...part, meta: { ...part.meta, stores: params.stores, store_count: params.stores.length } };
      onBatch?.(merged);
    };

    // Each runner takes the next batch when its previous one lands.
    const runner = async (): Promise<void> => {
      const stores = batches[next++];
      if (!stores) return;
      absorb(await postSection<StoreScoreSection>("store-score", { ...params, stores }, signal));
      return runner();
    };

    await Promise.all(
      Array.from({ length: Math.min(STORE_SCORE_PARALLEL, batches.length) }, runner),
    );
    // Assigned inside the runners, which control-flow analysis can't see.
    const result = merged as StoreScoreSection | null;
    if (!result) throw new Error("No stores to score.");
    return result;
  },

  /** GET /api/reports/labor — the Labor report (Hiring). */
  getLabor(params: BusinessReportsParams, signal?: AbortSignal): Promise<LaborReport> {
    return getJson<LaborReport>(`/api/reports/labor?${query(params)}`, signal);
  },

  /** GET /api/reports/payroll-weeks — Hiring's payroll per store-week (final labor). */
  getPayrollWeeks(params: BusinessReportsParams, signal?: AbortSignal): Promise<PayrollWeeks> {
    return getJson<PayrollWeeks>(`/api/reports/payroll-weeks?${query(params)}`, signal);
  },

  /** GET /api/reports/wbr-bulk — feedback, complaints & money owed (hooks). */
  getFeedback(params: BusinessReportsParams, signal?: AbortSignal): Promise<WbrBulkResponse> {
    return getJson<WbrBulkResponse>(`/api/reports/wbr-bulk?${query(params)}`, signal);
  },

  /** Maintenance analytics summary for the range: tickets, recurring issues, statuses, per store. */
  getTickets(params: BusinessReportsParams, signal?: AbortSignal): Promise<AnalyticsSummary> {
    const range = daysToInstants(params.startDate, params.endDate);
    if (!range) throw new Error("Invalid date range.");
    return limited(() => maintenanceTicketsService.getAnalyticsSummary({ stores: params.stores, ...range }, signal));
  },

  /** Skills and their coverage by employees (Operations) for every loaded store, in one call. */
  getSkills(params: BusinessReportsParams, signal?: AbortSignal): Promise<StoreSkillsOverview> {
    return limited(() => schedulingService.getSkillsOverview(params.stores, signal));
  },
};
