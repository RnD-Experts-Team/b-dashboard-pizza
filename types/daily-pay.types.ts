/* ────────────────────────────────────────────────────────────────────────── */
/*  Daily Pay — End-of-day technician payment records                        */
/*                                                                            */
/*  THREE levels, as of the v2 backend release:                              */
/*                                                                            */
/*    Entry ............. the date                                            */
/*     └── Payment ...... one payee; money not attributable to any one store  */
/*          └── Line .... one store; its hours, money, and the issues it covers */
/*                                                                            */
/*  A payee is a Technician row — a company is simply a technician named      */
/*  after the company, so there is no separate entity to fetch.               */
/*                                                                            */
/*  Editing replaces the full entry while snapshotting the prior state.       */
/*                                                                            */
/*  Two conventions run through this whole file:                              */
/*   - Every decimal arrives from the API as a STRING ("49.99"; rates at 4dp, */
/*     "18.0000"). The Api* mirrors type them `string | null`; the service    */
/*     parses to numbers.                                                     */
/*   - `null` means "relation not loaded"; `[]` means "loaded and empty".     */
/*     Client relations are therefore `T[] | null`, never `T[]`. Do not `??`  */
/*     them together, or you will show "no notes" for a record whose notes    */
/*     simply were not fetched.                                               */
/* ────────────────────────────────────────────────────────────────────────── */

import type {
  UserRef,
  TicketNote,
  TicketAttachment,
  LaravelPaginationMeta,
  LaravelPaginationLinks,
  ApiTicketNote,
  ApiTicketAttachment,
} from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Client (camelCase) shapes                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/** Minimal store reference returned on each line. */
export interface DailyPayStoreRef {
  id: number;
  /** Human-readable store number, e.g. "03795-00001". */
  storeNumber: string;
}

/** A linked maintenance ticket issue (summary shown in the detail view). */
export interface DailyPayTicketIssue {
  id: number;
  ticketId: number;
  storeNumber: string | null;
  issueTitle: string | null;
  otherTitle: string | null;
  priority: string | null;
  status: string | null;
  description: string | null;
  technicians: { id: number; name: string }[];
}

/**
 * What the attendance and part records actually say, whether or not the figure
 * was overridden. FROZEN when the sheet is saved — a signed-off sheet does not
 * change because somebody corrected a ticket next month.
 * `POST .../recalculate` re-pulls these on demand.
 */
export interface DailyPayGathered {
  /** Net of breaks, travel and parts runs falling inside the shift. */
  workHours: number | null;
  travelHours: number | null;
  /** Tracked but NOT paid. */
  breakHours: number | null;
  partsRunHours: number | null;
  reimbursableParts: number | null;
  /** When the gather ran. */
  at: string | null;
  by: UserRef | null;
}

/**
 * Something the gather could not make sense of. NONE of these block anything —
 * a person decides. Surface as an advisory panel on the payment.
 *
 * Codes: overlapping_entries | entry_outside_date | part_usage_spans_stores |
 * already_claimed_same_date | claimed_on_other_entry |
 * incomplete_pair:<bucket> | inverted_pair:<bucket> | implausible_pair:<bucket>
 */
export interface DailyPayAggregationWarning {
  code: string;
  /**
   * Names the record ids involved so the UI can link straight to them.
   * Defaulted to `{}` rather than null — unlike every other relation here —
   * because callers read keys off it. See transformWarning.
   */
  context: Record<string, unknown>;
}

/** One store within a payment: its hours, its money, the issues it covers. */
export interface DailyPayLine {
  id: number;
  dailyPayPaymentId: number;
  /** Null when the line uses `otherStore` instead of a replicated store. */
  storeId: number | null;
  store: DailyPayStoreRef | null;
  /** Free-text location outside the replicated store list. */
  otherStore: string | null;
  totalWorkingHours: number | null;
  /**
   * True once hours were sent explicitly; recalculating will never touch this
   * line again. Note that `total_working_hours: 0` counts as an override —
   * 0 is a legitimate value, not "unset".
   */
  hoursOverridden: boolean;
  /** Replaces hourly labour for this line; does NOT add to it. */
  lumpSum: number | null;
  hourlyPaymentRate: number | null;
  gas: number | null;
  /** An optional EXTRA amount also owed, added on top. NOT the total. */
  moneyOwed: number | null;
  /** line labour + line gas + line money_owed + parts attributed to this store. */
  lineTotal: number | null;
  gathered: DailyPayGathered | null;
  /** Only present on the detail endpoint. */
  ticketIssues: DailyPayTicketIssue[] | null;
  notes: TicketNote[] | null;
  attachments: TicketAttachment[] | null;
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

/** One payee, and the money not attributable to any single store. */
export interface DailyPayPayment {
  id: number;
  dailyPayEntryId: number;
  /** The payee. A company is a Technician row named after the company. */
  technicianId: number;
  technician: { id: number; name: string } | null;
  hourlyPaymentRate: number | null;
  gas: number | null;
  /** An optional EXTRA amount also owed. Label "additional owed", never "total". */
  moneyOwed: number | null;
  /** Replaces ALL of this payment's lines' labour. */
  lumpSum: number | null;
  /** THE payable figure. This is the number to show. */
  totalAmount: number | null;
  /**
   * Sum of the line totals, for a per-store breakdown. NOT the payable figure —
   * it excludes payment-level gas, additional owed and lump sum.
   */
  linesTotal: number | null;
  gathered: DailyPayGathered | null;
  /** Null when not loaded; `[]` on detail when there are none. */
  aggregationWarnings: DailyPayAggregationWarning[] | null;
  /** Null on the list endpoint — the list returns payments and their money only. */
  lines: DailyPayLine[] | null;
  notes: TicketNote[] | null;
  attachments: TicketAttachment[] | null;
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A snapshot of a previous state of the entry, kept as revision history.
 *
 * `schemaVersion` MUST be read before rendering `snapshot`: old snapshots are
 * never rewritten, so both shapes exist in history forever.
 *   1 → { date, lines: [...] }                       (pre-v2)
 *   2 → { date, payments: [{ …, lines: [...] }] }
 * A renderer that assumes v2 shows every pre-migration revision as blank.
 */
export interface DailyPayRevision {
  id: number;
  dailyPayEntryId: number;
  snapshot: unknown;
  /** Null on rows written before the column existed — infer from shape. */
  schemaVersion: number | null;
  editedBy: number | null;
  editor: UserRef | null;
  createdAt: string;
}

/** A daily pay entry (list summary and full detail share this shape). */
export interface DailyPayEntry {
  id: number;
  date: string;
  /** Null when not loaded. */
  payments: DailyPayPayment[] | null;
  /** The sum across payments. */
  totalAmount: number | null;
  /** Only present on the detail endpoint. */
  revisions: DailyPayRevision[] | null;
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
  /** Pass back as `expectedUpdatedAt` on edit to get a 409 instead of a clobber. */
  updatedAt: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Pagination                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export interface DailyPayListResponse {
  data: DailyPayEntry[];
  links: LaravelPaginationLinks;
  meta: LaravelPaginationMeta;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Payloads (what the UI sends to the service)                              */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * A line's labour basis — exactly one of three states.
 *
 * Encoded as a discriminated union rather than optional numbers on purpose:
 * it makes "unset" a TAG rather than a sentinel value inside a numeric domain,
 * so no stray `?? 0` or NaN can silently flip the meaning. That matters here
 * because the three states pay differently:
 *
 *   gather  → send NO total_working_hours key. The backend gathers hours from
 *             the attendance entries clocked against this line's ticket_issue_ids.
 *   hours   → send total_working_hours. 0 IS a legitimate override, not "unset".
 *             The line comes back hours_overridden: true, permanently.
 *   lumpSum → send lump_sum. REPLACES labour; hours are not sent.
 *
 * `lumpSum` excluding hours is a UI restriction, not a backend one. If that
 * ever needs to change, widen this one type rather than every call site.
 */
export type DailyPayLabourInput =
  | { kind: "gather" }
  | { kind: "hours"; totalWorkingHours: number }
  | { kind: "lumpSum"; lumpSum: number };

/**
 * Payment-level labour. Same 0-vs-unset hazard as the line level: the server
 * computes `payment lump_sum ?? Σ line labour`, so a lump sum of 0 means
 * "labour is zero" while an absent one means "sum the lines".
 */
export type DailyPayPaymentLabourInput =
  | { kind: "sumLines" }
  | { kind: "lumpSum"; lumpSum: number };

/** A line takes store_id OR other_store. Sending neither is a 422. */
export type DailyPayLineLocationInput =
  | { kind: "store"; storeId: number }
  | { kind: "other"; otherStore: string };

export interface DailyPayNoteInput {
  body: string;
  type?: string | null;
  files?: File[];
}

export interface DailyPayLineInput {
  location: DailyPayLineLocationInput;
  labour: DailyPayLabourInput;
  /** Ignored by the server when labour.kind === "lumpSum". */
  hourlyPaymentRate?: number | null;
  gas?: number | null;
  /** An EXTRA amount also owed for this store. */
  moneyOwed?: number | null;
  /**
   * The PAYMENT's payee must already be assigned to every issue named here,
   * or you get a 422 on payments.N.lines.M.ticket_issue_ids.
   */
  ticketIssueIds?: number[];
  notes?: DailyPayNoteInput[];
  files?: File[];
}

export interface DailyPayPaymentInput {
  /** The payee — a Technician id. */
  technicianId: number;
  labour: DailyPayPaymentLabourInput;
  hourlyPaymentRate?: number | null;
  gas?: number | null;
  moneyOwed?: number | null;
  notes?: DailyPayNoteInput[];
  files?: File[];
  /**
   * At least one. ALL of a payee's stores go on THIS payment — a payee
   * appearing twice in payments[] is a 422 on payments.N.technician_id.
   */
  lines: DailyPayLineInput[];
}

export interface DailyPayEntryInput {
  /** Workday date (YYYY-MM-DD). */
  date: string;
  payments: DailyPayPaymentInput[];
  /**
   * The `updated_at` last read. Present means a stale edit is refused with 409
   * instead of silently overwriting the other person's figures.
   * Omit to opt out of the check (legacy behaviour).
   */
  expectedUpdatedAt?: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Filters (mirror the list query parameters; synced to the URL)            */
/* ────────────────────────────────────────────────────────────────────────── */

export type DailyPaySortColumn = "date" | "created_at";
export type DailyPaySortDir = "asc" | "desc";

export interface DailyPayFilters {
  technician_ids?: number[];
  store_ids?: number[];
  date?: string;
  date_from?: string;
  date_to?: string;
  /** Now an ARRAY. Ids belong to the MAINTENANCE backend's user table. */
  filled_by?: number[];
  created_from?: string;
  created_to?: string;
  sort?: DailyPaySortColumn;
  dir?: DailyPaySortDir;
  per_page?: number;
  page?: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error state (used by the Zustand store)                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface DailyPayErrorState {
  message: string;
  code: string;
  retryable: boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Raw API snake_case types (mirror upstream Laravel responses)             */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ApiDailyPayStoreRef {
  id: number;
  store_number: string;
}

export interface ApiDailyPayTicketIssue {
  id: number;
  ticket_id: number;
  ticket?: {
    id: number;
    store_id: number;
    store?: { id: number; store_number: string } | null;
  } | null;
  issue_id: number | null;
  issue?: { id: number; title: string; description: string | null } | null;
  other_title: string | null;
  priority: string | null;
  description: string | null;
  status: string | null;
  technicians?: { id: number; name: string }[];
}

export interface ApiDailyPayGathered {
  work_hours: string | null;
  travel_hours: string | null;
  break_hours: string | null;
  parts_run_hours: string | null;
  reimbursable_parts: string | null;
  at: string | null;
  by?: { id: number; name: string; email: string | null } | null;
}

export interface ApiDailyPayAggregationWarning {
  code: string;
  context?: Record<string, unknown> | null;
}

export interface ApiDailyPayLine {
  id: number;
  daily_pay_payment_id: number;
  store_id: number | null;
  store?: ApiDailyPayStoreRef | null;
  other_store: string | null;
  total_working_hours: string | null;
  hours_overridden?: boolean;
  lump_sum: string | null;
  hourly_payment_rate: string | null;
  gas: string | null;
  money_owed: string | null;
  line_total: string | null;
  gathered?: ApiDailyPayGathered | null;
  ticket_issues?: ApiDailyPayTicketIssue[] | null;
  notes?: ApiTicketNote[] | null;
  attachments?: ApiTicketAttachment[] | null;
  created_by?: number | null;
  creator?: { id: number; name: string; email: string | null } | null;
  created_at: string;
  updated_at: string;
}

export interface ApiDailyPayPayment {
  id: number;
  daily_pay_entry_id: number;
  technician_id: number;
  technician?: { id: number; name: string } | null;
  hourly_payment_rate: string | null;
  gas: string | null;
  money_owed: string | null;
  lump_sum: string | null;
  total_amount: string | null;
  lines_total: string | null;
  gathered?: ApiDailyPayGathered | null;
  aggregation_warnings?: ApiDailyPayAggregationWarning[] | null;
  lines?: ApiDailyPayLine[] | null;
  notes?: ApiTicketNote[] | null;
  attachments?: ApiTicketAttachment[] | null;
  created_by?: number | null;
  creator?: { id: number; name: string; email: string | null } | null;
  created_at: string;
  updated_at: string;
}

export interface ApiDailyPayRevision {
  id: number;
  daily_pay_entry_id: number;
  snapshot: unknown;
  schema_version?: number | null;
  edited_by: number | null;
  editor?: { id: number; name: string; email: string | null } | null;
  created_at: string;
}

export interface ApiDailyPayEntry {
  id: number;
  date: string;
  payments?: ApiDailyPayPayment[] | null;
  total_amount?: string | null;
  revisions?: ApiDailyPayRevision[] | null;
  created_by?: number | null;
  creator?: { id: number; name: string; email: string | null } | null;
  created_at: string;
  updated_at: string;
}

/* ── Revision snapshot shapes ─────────────────────────────────────────────── */
/*  Snapshots are raw snake_case API JSON, never run through the transformers, */
/*  and they carry IDS, not names. The viewer resolves ids against the         */
/*  technician / store catalogs it is handed.                                  */

/** A line inside a v1 (pre-payments) snapshot. Note `invoices`, since dropped. */
export interface ApiDailyPaySnapshotLineV1 {
  store_id?: number | null;
  technician_id?: number | null;
  total_working_hours?: string | number | null;
  total_break_time?: string | number | null;
  travel_time?: string | number | null;
  hourly_payment_rate?: string | number | null;
  gas?: string | number | null;
  invoices?: string | number | null;
  money_owed?: string | number | null;
  ticket_issue_ids?: number[] | null;
  [key: string]: unknown;
}

export interface ApiDailyPaySnapshotLineV2 {
  store_id?: number | null;
  other_store?: string | null;
  total_working_hours?: string | number | null;
  hours_overridden?: boolean | null;
  lump_sum?: string | number | null;
  hourly_payment_rate?: string | number | null;
  gas?: string | number | null;
  money_owed?: string | number | null;
  ticket_issue_ids?: number[] | null;
  [key: string]: unknown;
}

export interface ApiDailyPaySnapshotPaymentV2 {
  technician_id?: number | null;
  hourly_payment_rate?: string | number | null;
  gas?: string | number | null;
  money_owed?: string | number | null;
  lump_sum?: string | number | null;
  total_amount?: string | number | null;
  lines?: ApiDailyPaySnapshotLineV2[] | null;
  [key: string]: unknown;
}

/**
 * The list endpoint may return either the nested resource envelope
 * ({ data, links, meta }) or Laravel's flat simple-pagination root.
 * The service normalises both.
 */
export interface ApiDailyPayListResponse {
  data: ApiDailyPayEntry[];
  // Nested resource envelope
  links?: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  } | null;
  meta?: {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
  } | null;
  // Flat (simple) pagination root
  current_page?: number;
  first_page_url?: string | null;
  from?: number | null;
  last_page?: number;
  last_page_url?: string | null;
  next_page_url?: string | null;
  per_page?: number;
  prev_page_url?: string | null;
  to?: number | null;
  total?: number;
}

export interface ApiDailyPayEntryResponse {
  data: ApiDailyPayEntry;
}
