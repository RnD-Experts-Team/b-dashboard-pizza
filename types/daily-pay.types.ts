/* ────────────────────────────────────────────────────────────────────────── */
/*  Daily Pay — End-of-day technician payment records                        */
/*                                                                            */
/*  One entry (per workday submission) covers any number of                  */
/*  technician × store combinations, each represented as a "line".           */
/*  Editing replaces the full entry while snapshotting the prior state.       */
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

/** One technician × store line within a daily pay entry. */
export interface DailyPayLine {
  id: number;
  dailyPayEntryId: number;
  technicianId: number;
  technician: { id: number; name: string } | null;
  storeId: number;
  store: DailyPayStoreRef | null;
  /** Decimal fields — API returns them as strings; the service parses to numbers. */
  totalWorkingHours: number | null;
  gas: number | null;
  invoices: number | null;
  hourlyPaymentRate: number | null;
  moneyOwed: number | null;
  travelTime: number | null;
  totalBreakTime: number | null;
  /** Only present on the detail endpoint. */
  ticketIssues: DailyPayTicketIssue[];
  notes: TicketNote[];
  attachments: TicketAttachment[];
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

/** A snapshot of a previous state of the entry, kept as revision history. */
export interface DailyPayRevision {
  id: number;
  dailyPayEntryId: number;
  snapshot: unknown;
  editedBy: number | null;
  createdAt: string;
}

/** A daily pay entry (list summary and full detail share this shape). */
export interface DailyPayEntry {
  id: number;
  date: string;
  lines: DailyPayLine[];
  /** Only present on the detail endpoint. */
  revisions: DailyPayRevision[];
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
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

export interface DailyPayNoteInput {
  body: string;
  type?: string | null;
  /** Files to attach to this note (multipart only). */
  files?: File[];
}

export interface DailyPayLineInput {
  storeId: number;
  technicianId: number;
  totalWorkingHours?: number | null;
  gas?: number | null;
  invoices?: number | null;
  hourlyPaymentRate?: number | null;
  moneyOwed?: number | null;
  travelTime?: number | null;
  totalBreakTime?: number | null;
  /** Optional ticket issue IDs to link. The technician must be assigned to each. */
  ticketIssueIds?: number[];
  notes?: DailyPayNoteInput[];
  /** Files attached directly to this line (multipart only). */
  files?: File[];
}

export interface DailyPayEntryInput {
  /** Workday date (YYYY-MM-DD). */
  date: string;
  lines: DailyPayLineInput[];
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
  filled_by?: number;
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

export interface ApiDailyPayLine {
  id: number;
  daily_pay_entry_id: number;
  technician_id: number;
  technician?: { id: number; name: string } | null;
  store_id: number;
  store?: ApiDailyPayStoreRef | null;
  total_working_hours: string | null;
  gas: string | null;
  invoices: string | null;
  hourly_payment_rate: string | null;
  money_owed: string | null;
  travel_time: string | null;
  total_break_time: string | null;
  ticket_issues?: ApiDailyPayTicketIssue[];
  notes?: ApiTicketNote[];
  attachments?: ApiTicketAttachment[];
  created_by?: number | null;
  creator?: { id: number; name: string; email: string | null } | null;
  created_at: string;
  updated_at: string;
}

export interface ApiDailyPayRevision {
  id: number;
  daily_pay_entry_id: number;
  snapshot: unknown;
  edited_by: number | null;
  created_at: string;
}

export interface ApiDailyPayEntry {
  id: number;
  date: string;
  lines?: ApiDailyPayLine[];
  revisions?: ApiDailyPayRevision[];
  created_by?: number | null;
  creator?: { id: number; name: string; email: string | null } | null;
  created_at: string;
  updated_at: string;
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
