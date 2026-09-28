import axios from "axios";
import type {
  ActiveBreak,
  BreakDay,
  BreakDayExport,
  BreakEntry,
  BreakHistoryFilters,
  BreakNote,
  BreakSettings,
  BreakType,
  CreateBreakInput,
  LaravelPaginator,
  StartBreakInput,
  UpdateBreakInput,
} from "@/types/breaks.types";
import { BreakError, parseBreakError } from "@/lib/break-logger/errors";
import { historyQuery } from "@/lib/break-logger/payload";
import { handleUnauthorized } from "@/lib/api/services/scheduling.service";

/**
 * ToolboxPizza Breaks — client service.
 *
 * Talks to the same-origin proxy under `/api/toolbox/*`, so it uses bare
 * `axios` (the shared `axiosClient` points at the external auth API). Every
 * call throws a `BreakError`; a 401 also ends the session, since the
 * axiosClient interceptor that would normally do that never runs here.
 *
 * Response contracts differ on purpose (mirroring the API):
 *   - `listBreaks` returns the Laravel paginator BARE.
 *   - everything else unwraps `{ data }`.
 */

const BASE = "/api/toolbox";
const TIMEOUT_MS = 30_000;

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

function config(signal?: AbortSignal) {
  const token = getToken();
  if (!token) {
    throw new BreakError({ code: "NOT_AUTHENTICATED", message: "You must be logged in." });
  }
  return {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    timeout: TIMEOUT_MS,
    signal,
  };
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const parsed = parseBreakError(err);
    handleUnauthorized(parsed.code === "NOT_AUTHENTICATED" ? parsed.status : null);
    throw parsed;
  }
}

/**
 * A 2xx whose body isn't the documented shape (an HTML error page from a
 * gateway, an empty body, a changed contract) must fail as an error the UI
 * can render — not flow `undefined` into components that then crash.
 */
function malformed(): BreakError {
  return new BreakError({
    code: "SERVER",
    message: "The breaks service sent an unexpected response.",
  });
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** `{ data: {...} }` → the object. */
function unwrapObject<T>(body: unknown): T {
  if (isObject(body) && isObject(body.data)) return body.data as T;
  throw malformed();
}

/** `{ data: {...} | null }` → the object or null (`breaks/active` when idle). */
function unwrapNullable<T>(body: unknown): T | null {
  if (isObject(body) && (body.data === null || isObject(body.data))) return body.data as T | null;
  throw malformed();
}

/** `{ data: [...] }` → the array. */
function unwrapArray<T>(body: unknown): T[] {
  if (isObject(body) && Array.isArray(body.data)) return body.data as T[];
  throw malformed();
}

export const breaksService = {
  /* ── Catalogue & settings ─────────────────────────────────────────── */

  /** An empty `[]` is a real answer (nothing seeded); a malformed body is an error. */
  getTypes(signal?: AbortSignal): Promise<BreakType[]> {
    return call(async () =>
      unwrapArray<BreakType>((await axios.get(`${BASE}/break-types`, config(signal))).data)
    );
  },

  /** Creates the settings row upstream on first read — safe to call on boot. */
  getSettings(signal?: AbortSignal): Promise<BreakSettings> {
    return call(async () =>
      unwrapObject<BreakSettings>((await axios.get(`${BASE}/break-settings`, config(signal))).data)
    );
  },

  updateSettings(dailyAllowanceMinutes: number): Promise<BreakSettings> {
    return call(async () =>
      unwrapObject<BreakSettings>(
        (
          await axios.post(
            `${BASE}/break-settings`,
            { daily_allowance_minutes: dailyAllowanceMinutes },
            config()
          )
        ).data
      )
    );
  },

  /** The caller's thresholds as a flat ascending int array (ids aren't exposed). */
  getMilestones(signal?: AbortSignal): Promise<number[]> {
    return call(async () =>
      unwrapArray<number>((await axios.get(`${BASE}/break-milestones`, config(signal))).data)
    );
  },

  /** Whole-list replace. `[]` is valid and turns milestones off. */
  replaceMilestones(thresholds: number[]): Promise<number[]> {
    return call(async () =>
      unwrapArray<number>(
        (await axios.post(`${BASE}/break-milestones`, { thresholds }, config())).data
      )
    );
  },

  /* ── Timer ────────────────────────────────────────────────────────── */

  /** ⚠ This read WRITES upstream (milestone evaluation). Never prefetch it. */
  getActive(signal?: AbortSignal): Promise<ActiveBreak | null> {
    return call(async () =>
      unwrapNullable<ActiveBreak>((await axios.get(`${BASE}/breaks/active`, config(signal))).data)
    );
  },

  start(input: StartBreakInput): Promise<BreakEntry> {
    return call(async () =>
      unwrapObject<BreakEntry>((await axios.post(`${BASE}/breaks/start`, input, config())).data)
    );
  },

  stop(id: number): Promise<BreakEntry> {
    return call(async () =>
      unwrapObject<BreakEntry>((await axios.post(`${BASE}/breaks/${id}/stop`, {}, config())).data)
    );
  },

  /* ── Day view ─────────────────────────────────────────────────────── */

  /** ⚠ Writes upstream while the day is open. Omit `date` for the current work date. */
  getDay(date?: string, signal?: AbortSignal): Promise<BreakDay> {
    return call(async () =>
      unwrapObject<BreakDay>(
        (
          await axios.get(`${BASE}/breaks/day`, {
            ...config(signal),
            params: date ? { date } : undefined,
          })
        ).data
      )
    );
  },

  /** Only on "copy summary" — never on a poll. */
  exportDay(date?: string): Promise<BreakDayExport> {
    return call(async () =>
      unwrapObject<BreakDayExport>(
        (
          await axios.get(`${BASE}/breaks/day/export`, {
            ...config(),
            params: date ? { date } : undefined,
          })
        ).data
      )
    );
  },

  /* ── History ──────────────────────────────────────────────────────── */

  /** Bare paginator — no `{data}` wrapper, rows at top-level `data[]`. */
  listBreaks(
    filters: BreakHistoryFilters,
    signal?: AbortSignal
  ): Promise<LaravelPaginator<BreakEntry>> {
    return call(async () => {
      const body: unknown = (
        await axios.get(`${BASE}/breaks?${historyQuery(filters).toString()}`, config(signal))
      ).data;
      if (!isObject(body) || !Array.isArray(body.data)) throw malformed();
      return body as unknown as LaravelPaginator<BreakEntry>;
    });
  },

  getBreak(id: number, signal?: AbortSignal): Promise<BreakEntry> {
    return call(async () =>
      unwrapObject<BreakEntry>((await axios.get(`${BASE}/breaks/${id}`, config(signal))).data)
    );
  },

  /** The "forgot to time it" path — recorded as `source: "manual"`. */
  create(input: CreateBreakInput): Promise<BreakEntry> {
    return call(async () =>
      unwrapObject<BreakEntry>((await axios.post(`${BASE}/breaks`, input, config())).data)
    );
  },

  /** Partial. Build `input` with `buildUpdatePayload` — key presence matters. */
  update(id: number, input: UpdateBreakInput): Promise<BreakEntry> {
    return call(async () =>
      unwrapObject<BreakEntry>((await axios.post(`${BASE}/breaks/${id}`, input, config())).data)
    );
  },

  /** Hard delete, notes included. 204. */
  remove(id: number): Promise<void> {
    return call(async () => {
      await axios.delete(`${BASE}/breaks/${id}`, config());
    });
  },

  /** Returns ONLY the note, not the break. Text only — no attachments exist. */
  addNote(id: number, body: string): Promise<BreakNote> {
    return call(async () =>
      unwrapObject<BreakNote>(
        (await axios.post(`${BASE}/breaks/${id}/notes`, { body }, config())).data
      )
    );
  },
};
