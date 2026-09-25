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

type Envelope<T> = { data: T };

export const breaksService = {
  /* ── Catalogue & settings ─────────────────────────────────────────── */

  getTypes(signal?: AbortSignal): Promise<BreakType[]> {
    return call(async () =>
      (await axios.get<Envelope<BreakType[]>>(`${BASE}/break-types`, config(signal))).data.data
    );
  },

  /** Creates the settings row upstream on first read — safe to call on boot. */
  getSettings(signal?: AbortSignal): Promise<BreakSettings> {
    return call(async () =>
      (await axios.get<Envelope<BreakSettings>>(`${BASE}/break-settings`, config(signal))).data.data
    );
  },

  updateSettings(dailyAllowanceMinutes: number): Promise<BreakSettings> {
    return call(async () =>
      (
        await axios.post<Envelope<BreakSettings>>(
          `${BASE}/break-settings`,
          { daily_allowance_minutes: dailyAllowanceMinutes },
          config()
        )
      ).data.data
    );
  },

  /** Whole-list replace. `[]` is valid and turns milestones off. */
  replaceMilestones(thresholds: number[]): Promise<number[]> {
    return call(async () =>
      (
        await axios.post<Envelope<number[]>>(`${BASE}/break-milestones`, { thresholds }, config())
      ).data.data
    );
  },

  /* ── Timer ────────────────────────────────────────────────────────── */

  /** ⚠ This read WRITES upstream (milestone evaluation). Never prefetch it. */
  getActive(signal?: AbortSignal): Promise<ActiveBreak | null> {
    return call(async () =>
      (await axios.get<Envelope<ActiveBreak | null>>(`${BASE}/breaks/active`, config(signal))).data
        .data
    );
  },

  start(input: StartBreakInput): Promise<BreakEntry> {
    return call(async () =>
      (await axios.post<Envelope<BreakEntry>>(`${BASE}/breaks/start`, input, config())).data.data
    );
  },

  stop(id: number): Promise<BreakEntry> {
    return call(async () =>
      (await axios.post<Envelope<BreakEntry>>(`${BASE}/breaks/${id}/stop`, {}, config())).data.data
    );
  },

  /* ── Day view ─────────────────────────────────────────────────────── */

  /** ⚠ Writes upstream while the day is open. Omit `date` for the current work date. */
  getDay(date?: string, signal?: AbortSignal): Promise<BreakDay> {
    return call(async () =>
      (
        await axios.get<Envelope<BreakDay>>(`${BASE}/breaks/day`, {
          ...config(signal),
          params: date ? { date } : undefined,
        })
      ).data.data
    );
  },

  /** Only on "copy summary" — never on a poll. */
  exportDay(date?: string): Promise<BreakDayExport> {
    return call(async () =>
      (
        await axios.get<Envelope<BreakDayExport>>(`${BASE}/breaks/day/export`, {
          ...config(),
          params: date ? { date } : undefined,
        })
      ).data.data
    );
  },

  /* ── History ──────────────────────────────────────────────────────── */

  /** Bare paginator — no `{data}` wrapper, rows at top-level `data[]`. */
  listBreaks(
    filters: BreakHistoryFilters,
    signal?: AbortSignal
  ): Promise<LaravelPaginator<BreakEntry>> {
    return call(async () =>
      (
        await axios.get<LaravelPaginator<BreakEntry>>(
          `${BASE}/breaks?${historyQuery(filters).toString()}`,
          config(signal)
        )
      ).data
    );
  },

  getBreak(id: number, signal?: AbortSignal): Promise<BreakEntry> {
    return call(async () =>
      (await axios.get<Envelope<BreakEntry>>(`${BASE}/breaks/${id}`, config(signal))).data.data
    );
  },

  /** The "forgot to time it" path — recorded as `source: "manual"`. */
  create(input: CreateBreakInput): Promise<BreakEntry> {
    return call(async () =>
      (await axios.post<Envelope<BreakEntry>>(`${BASE}/breaks`, input, config())).data.data
    );
  },

  /** Partial. Build `input` with `buildUpdatePayload` — key presence matters. */
  update(id: number, input: UpdateBreakInput): Promise<BreakEntry> {
    return call(async () =>
      (await axios.post<Envelope<BreakEntry>>(`${BASE}/breaks/${id}`, input, config())).data.data
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
      (await axios.post<Envelope<BreakNote>>(`${BASE}/breaks/${id}/notes`, { body }, config())).data
        .data
    );
  },
};
