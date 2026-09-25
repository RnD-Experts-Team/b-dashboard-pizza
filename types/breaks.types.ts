/**
 * ToolboxPizza Breaks — wire types, mirroring the API exactly (snake_case).
 *
 * Every timestamp is ISO-8601 with an offset (`2026-09-15T18:10:00+00:00`);
 * every `work_date` is a bare `YYYY-MM-DD` WORK date (cutoff-to-cutoff), not a
 * calendar date.
 */

export type BreakGroup = "regular" | "special";
export type BreakSource = "timer" | "manual";

export interface BreakType {
  id: number;
  slug: string;
  name: string;
  /** Presentation only — which picker block. Never use it for totals. */
  group: BreakGroup;
  group_label: string;
  counts_toward_limit: boolean;
  requires_custom_label: boolean;
  sort_order: number;
}

/** The trimmed type embedded in every entry. */
export interface BreakTypeRef {
  id: number;
  slug: string;
  name: string;
  group: BreakGroup;
  requires_custom_label: boolean;
}

export interface BreakNote {
  id: number;
  body: string;
  created_by: number;
  creator: { id: number; name: string } | null;
  created_at: string;
}

export interface BreakEntry {
  id: number;
  break_type: BreakTypeRef;
  other_label: string | null;
  /** Already resolves catalogue name vs custom text — render this. */
  label: string;
  started_at: string;
  ended_at: string | null;
  running: boolean;
  work_date: string;
  duration_seconds: number;
  duration_minutes: number;
  /** Snapshot taken when written — the only source for counted/excluded. */
  counts_toward_limit: boolean;
  /** Origin only; an edited entry still says `timer`. */
  source: BreakSource;
  notes: BreakNote[];
  created_at: string;
  updated_at: string;
}

/** `GET breaks/active` adds one key found nowhere else. */
export interface ActiveBreak extends BreakEntry {
  belongs_to_previous_work_day: boolean;
}

export interface WorkDayInfo {
  cutoff_hour: number;
  timezone: string;
}

export interface BreakSettings {
  daily_allowance_minutes: number;
  thresholds: number[];
  work_day: WorkDayInfo;
  max_milestones: number;
}

export interface BreakCategory {
  break_type_id: number;
  slug: string;
  name: string;
  label: string;
  counts_toward_limit: boolean;
  entry_count: number;
  seconds: number;
  minutes: number;
}

export interface BreakMilestoneFiring {
  kind: "milestone" | "allowance";
  threshold_minutes: number;
  /** The true instant — show this, not `noticed_at`. */
  crossed_at: string;
  noticed_at: string;
  notified: boolean;
}

export interface BreakDay {
  work_date: string;
  work_day: WorkDayInfo & { starts_at: string; ends_at: string };
  user: { id: number; name: string; email: string };

  allowance_minutes: number;
  counted_seconds: number;
  counted_minutes: number;
  excluded_seconds: number;
  excluded_minutes: number;
  total_seconds: number;
  total_minutes: number;
  remaining_minutes: number;
  over_minutes: number;
  over_limit: boolean;
  entry_count: number;
  has_active_break: boolean;

  as_of: string;
  generated_at: string;
  self_reported: boolean;

  categories: BreakCategory[];
  /** Ascending by started_at — the opposite of GET /breaks. */
  entries: BreakEntry[];

  milestones: {
    thresholds: number[];
    fired: BreakMilestoneFiring[];
    pending: number[];
  };
}

export interface BreakDayExport extends BreakDay {
  text: string;
}

/** `GET /breaks` returns the Laravel paginator bare — no `{data}` wrapper. */
export interface LaravelPaginator<T> {
  current_page: number;
  data: T[];
  per_page: number;
  total: number;
  last_page: number;
  from: number | null;
  to: number | null;
}

export interface BreakHistoryFilters {
  from?: string;
  to?: string;
  source?: BreakSource;
  /** undefined = both. Sent as 0/1, never true/false. */
  countsTowardLimit?: boolean;
  breakTypeIds?: number[];
  page?: number;
  perPage?: number;
}

/* ── Request bodies ───────────────────────────────────────────────────── */

export interface StartBreakInput {
  break_type_id: number;
  other_label?: string;
}

export interface CreateBreakInput {
  break_type_id: number;
  other_label?: string;
  started_at: string;
  ended_at: string;
}

/**
 * Partial update. KEY PRESENCE IS LOAD-BEARING: `ended_at: null` reopens the
 * break; omit the key to leave the end untouched. Build it with
 * `buildUpdatePayload`, never by spreading a form.
 */
export interface UpdateBreakInput {
  break_type_id?: number;
  other_label?: string | null;
  started_at?: string;
  ended_at?: string | null;
}

/* ── Errors ───────────────────────────────────────────────────────────── */

export type BreakDomainErrorCode =
  | "ALREADY_ON_BREAK"
  | "BREAK_OVERLAP"
  | "BREAK_NOT_RUNNING"
  | "BREAK_ENDS_BEFORE_START"
  | "BREAK_STARTS_IN_FUTURE"
  | "BREAK_OUTSIDE_RETENTION_WINDOW"
  | "BREAK_CUSTOM_LABEL_REQUIRED"
  | "BREAK_CUSTOM_LABEL_NOT_ALLOWED"
  | "BREAK_TYPE_INACTIVE";

export type BreakClientErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "NOT_AUTHENTICATED"
  | "CONFIG_MISSING"
  | "TIMEOUT"
  | "NETWORK"
  | "SERVER"
  | "CANCELLED"
  | "UNKNOWN";

export type BreakErrorCode = BreakDomainErrorCode | BreakClientErrorCode;

export interface BreakRunningRef {
  id: number;
  label: string;
  started_at: string;
}

export interface BreakConflict {
  id: number;
  label: string;
  started_at: string;
  ended_at: string | null;
  running: boolean;
  work_date: string;
}
