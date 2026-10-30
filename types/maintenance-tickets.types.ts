/* ────────────────────────────────────────────────────────────────────────── */
/*  Enums / Scalars                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * v2 statuses (MAINTENANCE-V2 §2). The ticket status is derived from its
 * issues and uses the same values. Labels: lib/maintenance/vocabulary.ts.
 */
import type { IssueStatus } from "@/types/maintenance-v2/workflow.types";
export type { IssueStatus };
export type TicketStatus = IssueStatus;
export type Priority = "urgent" | "high" | "medium" | "low";
export type TicketType = "normal" | "preventive_maintenance";

/** Typed closing-note categories on a ticket. Generic notes use `null`. */
export type NoteType = "final_notes" | "what_we_learned";

/**
 * The API returns enum fields as { value: "...", label: "..." }.
 * When posting, send the raw `value` string.
 */
export interface EnumField {
  value: string;
  label: string;
}

/**
 * Whether the money owed on a record has been paid. DERIVED ON READ from the
 * daily pay sheets themselves, so it can never disagree with them — nothing
 * stores it and nothing needs keeping in sync.
 *
 * Being on a pay sheet IS being paid; there is no separate "money sent" step.
 *
 *   unpaid      → owed, and not yet on any pay sheet
 *   paid        → covered by a pay sheet
 *   not_payable → nobody is owed: a part we bought ourselves, or a mistaken record
 */
export type PaymentStatusValue = "unpaid" | "paid" | "not_payable";

/** Returned as { value, label }; filters take the bare `value`. */
export type PaymentStatusField = EnumField & { value: PaymentStatusValue };









/** Minimal storage-location reference on a part usage. */
export interface StorageLocationRef {
  id: number;
  name: string;
  code: string | null;
}

/** Minimal user reference returned in `creator` fields. */
export interface UserRef {
  id: number;
  name: string;
  email: string | null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Catalog types (reference data – loaded once)                           */
/* ────────────────────────────────────────────────────────────────────────── */

export interface CatalogIssue {
  id: number;
  title: string;
  description: string | null;
  /**
   * How many troubleshooting guides (with steps) it has -- a store goes
   * through them before opening a ticket for it. Null when not counted.
   */
  troubleshootingGuidesCount: number | null;
  deletedAt: string | null;
  notes?: TicketNote[];
  attachments?: TicketAttachment[];
}




/* ────────────────────────────────────────────────────────────────────────── */
/*  Ticket + Issue (client camelCase)                                       */
/* ────────────────────────────────────────────────────────────────────────── */



export interface TicketIssueStatusChange {
  id: number;
  status: EnumField;
  changedBy: string | null;
  creator: UserRef | null;
  reason: string | null;
  createdAt: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Lifecycle record entity types                                           */
/* ────────────────────────────────────────────────────────────────────────── */

/** A file attached to any entity (record, note, ticket, catalog item…). */
export interface TicketAttachment {
  id: number;
  fileName: string;
  fileSize: number | null;
  contentType: string | null;
  /** Ready-to-use download URL provided by the API. */
  url: string;
  createdBy: number | null;
  createdAt: string;
}

/**
 * A free-text note attached to any entity. Notes are append-only.
 * `type` is null for generic notes; ticket closing notes use a NoteType.
 */
export interface TicketNote {
  id: number;
  type: string | null;
  typeLabel: string | null;
  body: string;
  /**
   * Locked note (MOS only). Only the ticket's "all notes" read returns one;
   * every other read leaves it out, files and all.
   */
  isPrivate: boolean;
  /** When it was last locked or unlocked, and by whom. */
  lockedAt: string | null;
  locker: { id: number; name: string } | null;
  attachments: TicketAttachment[];
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
  updatedAt: string;
}









/** The slim issue shape the ticket LIST carries. */
export interface TicketIssueSummary {
  id: number;
  title: string;
  status: EnumField | null;
  priority: EnumField | null;
  /**
   * Who is on it. The index already sends these; dropping them here was why
   * anything put in the pay basket from the rail arrived with no payee, and
   * the same person's work split across a "known" and an "unknown" payment.
   */
  technicians: Array<{ id: number; name: string }>;
  /** v2: when the office aims to have it done (null = not set). */
  targetCompletionAt?: string | null;
}

export interface Ticket {
  id: number;
  storeId: string | null;
  otherStore: string | null;
  type: EnumField | null;
  status: EnumField;
  /** All ticket notes (closing notes have a non-null `type`; generic notes are null). */
  notes: TicketNote[];
  attachments: TicketAttachment[];
  creator: UserRef | null;
  issueCount: number;
  /**
   * The issues themselves, as far as the LIST endpoint reports them.
   *
   * Enough to tick a ticket into a basket without opening it -- a basket holds
   * issues, and the rail only knows tickets. The index already eager-loads
   * `ticketIssues`, so this costs nothing extra.
   *
   * `[]` when the API sent none. Do not confuse with the full `TicketIssue`
   * from the detail endpoint, which carries the whole history.
   */
  issues: TicketIssueSummary[];
  /** Issue titles from the list response (may be empty if API doesn't include them). */
  issueTitles: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Laravel pagination                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export interface LaravelPaginationMeta {
  currentPage: number;
  from: number | null;
  lastPage: number;
  perPage: number;
  to: number | null;
  total: number;
}

export interface LaravelPaginationLinks {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
}

export interface TicketsListResponse {
  data: Ticket[];
  links: LaravelPaginationLinks;
  meta: LaravelPaginationMeta;
}


export interface TicketsAnalyticsStatusBreakdown {
  status: IssueStatus;
  label: string;
  count: number;
}

export interface TicketsAnalyticsDuration {
  avgSeconds: number | null;
  avgHours: number | null;
  sampleSize: number;
}

export interface TicketsAnalytics {
  issues: {
    total: number;
    statusBreakdown: TicketsAnalyticsStatusBreakdown[];
  };
  /**
   * How many issues need looking at, over the same filtered set.
   *
   *   overdue -- a non-terminal issue whose LATEST assignment is dated before
   *              `asOf`. Counts the plan slipping, not a missed SLA: this
   *              system has no due dates.
   *   stuck   -- an issue sitting in `waiting`.
   *
   * Both are null when the backend did not send them, and null renders as an
   * em dash rather than 0 -- "we don't know" is not "none", the same rule
   * avgTicketsPerWeek already follows.
   *
   * `asOf` exists because "in the past" is relative to the SERVER's date. Do
   * not recompute overdue against the browser's clock.
   */
  attention: {
    overdue: number | null;
    stuck: number | null;
    asOf: string | null;
  };
  durations: {
    pendingToNextStatus: TicketsAnalyticsDuration;
    timeToCompleteOrCancelled: TicketsAnalyticsDuration;
  };
  /**
   * NULLABLE THROUGHOUT. Every figure here is an aggregate over the matched
   * tickets, and the API sends `null` — not 0 — when there is nothing to
   * average: no tickets at all, or a filter combination that matches none.
   *
   * `durations.*.avgHours` above already said so; `value` did not, claimed to
   * be a plain `number`, and crashed the whole analytics panel on `.toFixed()`
   * the first time a filter matched nothing. Rendering 0 would be a lie —
   * "no tickets" is not "zero per week" — so these render as an em dash.
   */
  avgTicketsPerWeek: {
    value: number | null;
    totalTickets: number | null;
    weeksSpanned: number | null;
    spanStart: string | null;
    spanEnd: string | null;
    weekStartsOn: string | null;
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Payloads (what the UI sends to the service)                            */
/* ────────────────────────────────────────────────────────────────────────── */

export interface CreateTicketIssueRow {
  /** Catalog issue id – mutually exclusive with otherTitle */
  issueId?: number;
  /** Free-text title – mutually exclusive with issueId */
  otherTitle?: string;
  priority: Priority;
  description: string;
  /** Optional notes to attach to this issue at creation time (text only) */
  notes?: Array<{ body: string; type?: string | null }>;
  /** Files to attach directly to this issue (multipart only) */
  files?: File[];
  /** How troubleshooting went -- required when the issue has guides. */
  troubleshooting?: TroubleshootingTicketOutcome;
  /** The guide that matched, when they picked one ... */
  troubleshooting_guide_id?: number | null;
  /** ... and the version of it they read. */
  troubleshooting_version?: number | null;
  /** v2: how much it hurts the store (none | slowed | partly_down | closed). */
  impact?: import("@/types/maintenance-v2/workflow.types").Impact;
  /** v2: who to talk to at the store about it. */
  contactName?: string;
  contactPhone?: string;
}

export interface CreateTicketPayload {
  issues: CreateTicketIssueRow[];
  /** Optional ticket-level notes to attach at creation time */
  notes?: Array<{ body: string; type?: string | null }>;
  /** Files to attach directly to the ticket (multipart only) */
  files?: File[];
  type?: TicketType;
}









/** Generic free-text note for any entity (multipart; supports files). */
export interface CreateNotePayload {
  body: string;
  type?: string;
  /** 1 = locked (MOS only). Sent as "1": the API's boolean rule refuses "true". */
  is_private?: 0 | 1;
}











/* ────────────────────────────────────────────────────────────────────────── */
/*  Filters                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */


export interface TicketsFilters {
  /**
   * Free text across the ticket id (exact), the store number, the ticket's
   * other_store, and its issues' title and description. ANDs with every other
   * filter -- it narrows, it never widens.
   *
   * Note a digit string matches BOTH the ticket id and any store number
   * containing those digits. Both readings are wanted: you type "412" for a
   * ticket and "3795" for a store.
   */
  q?: string;
  /**
   * Tickets carrying an issue SCHEDULED in this window (non-mistaken
   * assignments only). This is what answers "what is on for today" --
   * created_from cannot, because a ticket raised in March is routinely worked
   * in September.
   */
  assigned_from?: string;
  assigned_to?: string;
  statuses?: TicketStatus[];
  priorities?: Priority[];
  /** Matches tickets with an issue whose independently-set assigned_priority is one of these. */
  assigned_priorities?: Priority[];
  issue_ids?: number[];
  issue_statuses?: IssueStatus[];
  technician_ids?: number[];
  types?: TicketType[];
  /** Global index only: limit to tickets for these store numbers (multi-select, OR logic) */
  stores?: string[];
  /** Who filed the ticket. */
  creator_ids?: number[];
  /**
   * Rolled up per ticket, with the same rules as the badge:
   *   unpaid      → at least one payable is still unclaimed
   *   paid        → has payables, and every one of them is claimed
   *   not_payable → no payables at all
   */
  payment_statuses?: PaymentStatusValue[];
  /** Both of these sum GROSS `cost`, not `net_cost` after returns. */
  part_cost_total_gt?: number;
  part_cost_single_gt?: number;
  created_from?: string;
  created_to?: string;
  /** Matches tickets with an issue that changed to any of these statuses within the changed_from/to range. */
  changed_statuses?: IssueStatus[];
  changed_from?: string;
  changed_to?: string;
  /** Include soft-deleted tickets: "with" = all, "only" = only deleted */
  trashed?: "with" | "only";
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error state (used by the Zustand store)                                */
/* ────────────────────────────────────────────────────────────────────────── */

export interface TicketsErrorState {
  message: string;
  code: string;
  retryable: boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Raw API snake_case types (mirrors upstream Laravel responses)          */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ApiEnumField {
  value: string;
  label: string;
}

export interface ApiCatalogIssue {
  id: number;
  title: string;
  description: string | null;
  troubleshooting_guides_count?: number | null;
  deleted_at: string | null;
  notes?: ApiTicketNote[];
  attachments?: ApiTicketAttachment[];
}







export interface ApiTicketIssueStatusChange {
  id: number;
  ticket_issue_id: number;
  from_status: string;
  to_status: string;
  reason: string | null;
  created_by: number | null;
  creator?: { id: number; name: string; email: string } | null;
  created_at: string;
}

export interface ApiTicketAttachment {
  id: number;
  file_name?: string;
  original_name?: string;
  path?: string;
  file_size?: number | null;
  size?: number | null;
  content_type?: string | null;
  mime_type?: string | null;
  url: string;
  created_by?: number | null;
  created_at: string;
}

export interface ApiTicketNote {
  id: number;
  type: string | null;
  type_label: string | null;
  body: string;
  is_private?: boolean;
  locked_by?: number | null;
  locked_at?: string | null;
  locker?: { id: number; name: string } | null;
  attachments?: ApiTicketAttachment[];
  created_by: number | null;
  creator: { id: number; name: string; email: string } | null;
  created_at: string;
  updated_at: string;
}

/** What a note from the ticket's notes reads sits on. */
export type TicketNoteOwnerType =
  | "ticket"
  | "ticket_issue"
  | "assignment"
  | "assignment_delay"
  | "diagnosis"
  | "attendance_entry"
  | "part_usage"
  | "pay_entry"
  | "warranty";

export interface ApiTicketNoteWithOwner extends ApiTicketNote {
  owner: { type: TicketNoteOwnerType | null; id: number };
}

export interface TicketNoteWithOwner extends TicketNote {
  owner: { type: TicketNoteOwnerType | null; id: number };
}






export interface ApiStorageLocationRef {
  id: number;
  name: string;
  code?: string | null;
}







export interface ApiTicket {
  id: number;
  store_id: number | string | null;
  other_store: string | null;
  type: ApiEnumField | null;
  store?: {
    id: number | string;
    store_number: string;
  } | null;
  status: ApiEnumField;
  /** Removed in v2.0; kept optional for backward-compat. */
  final_note?: string | null;
  notes?: ApiTicketNote[];
  attachments?: ApiTicketAttachment[];
  creator?: { id: number; name: string; email: string } | null;
  issues_count?: number;
  issues?: Array<{
    id: number;
    display_title?: string | null;
    title?: string | null;
    catalog_issue?: { title?: string | null } | null;
    status?: ApiEnumField | null;
    priority?: ApiEnumField | null;
    technicians?: Array<{ id: number; name: string }> | null;
    target_completion_at?: string | null;
  }>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Flat (simple) pagination envelope returned by this API */
export interface ApiTicketsListResponse {
  current_page: number;
  data: ApiTicket[];
  first_page_url: string | null;
  from: number | null;
  last_page: number;
  last_page_url: string | null;
  links: Array<{ url: string | null; label: string; page: number | null; active: boolean }>;
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
}


export interface ApiTicketsAnalyticsStatusBreakdown {
  status: IssueStatus;
  label: string;
  count: number;
}

export interface ApiTicketsAnalyticsDuration {
  avg_seconds: number | null;
  avg_hours: number | null;
  sample_size: number;
}

export interface ApiTicketsAnalytics {
  issues?: {
    total?: number | null;
    status_breakdown?: ApiTicketsAnalyticsStatusBreakdown[] | null;
  } | null;
  /**
   * Rides along on ?include_analytics=1 so the counts never cost a second
   * request. Optional because an older backend will not send it.
   */
  attention?: {
    overdue?: number | null;
    stuck?: number | null;
    as_of?: string | null;
  } | null;
  durations?: {
    pending_to_next_status?: ApiTicketsAnalyticsDuration | null;
    time_to_complete_or_cancelled?: ApiTicketsAnalyticsDuration | null;
  } | null;
  /** May be absent entirely, or present with null members — see TicketsAnalytics. */
  avg_tickets_per_week?: {
    value?: number | null;
    total_tickets?: number | null;
    weeks_spanned?: number | null;
    span_start?: string | null;
    span_end?: string | null;
    week_starts_on?: string | null;
  } | null;
}

/** Envelope returned by the dedicated GET /tickets/analytics and GET /stores/{store}/tickets/analytics endpoints */
export interface ApiTicketsAnalyticsResponse {
  data: ApiTicketsAnalytics;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Issue history: earlier tickets at a store for the same catalog issue     */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ApiIssueHistoryIssue {
  id: number;
  parent_id: number | null;
  status: ApiEnumField;
  priority: ApiEnumField;
  assigned_priority: ApiEnumField | null;
  /** First 160 characters. */
  description: string;
  completed_at: string | null;
  created_at: string;
}

export interface ApiIssueHistoryRow {
  ticket_id: number;
  store_number: string;
  created_at: string;
  creator: { id: number; name: string; email: string | null } | null;
  /** Where the newest of this ticket's rows for the issue stands now. */
  status: ApiEnumField | null;
  completed_at: string | null;
  technicians: { id: number; name: string }[];
  issues: ApiIssueHistoryIssue[];
}

/** Laravel's flat paginator, as the endpoint returns it. */
export interface ApiIssueHistoryResponse {
  data: ApiIssueHistoryRow[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface IssueHistoryIssue {
  id: number;
  parentId: number | null;
  status: EnumField;
  priority: EnumField;
  assignedPriority: EnumField | null;
  description: string;
  completedAt: string | null;
  createdAt: string;
}

/** One earlier ticket that reported the same catalog issue at the store. */
export interface IssueHistoryRow {
  ticketId: number;
  storeNumber: string;
  createdAt: string;
  creator: UserRef | null;
  status: EnumField | null;
  completedAt: string | null;
  technicians: { id: number; name: string }[];
  issues: IssueHistoryIssue[];
}

export interface IssueHistoryPage {
  rows: IssueHistoryRow[];
  page: number;
  lastPage: number;
  total: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Troubleshooting guides                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ApiTroubleshootingStep {
  id: number;
  position: number;
  body: string;
  attachments?: ApiTicketAttachment[];
}

export interface ApiTroubleshootingGuide {
  id: number;
  issue_id: number;
  title: string;
  steps: ApiTroubleshootingStep[];
  link_url: string | null;
  version: number;
  attachments?: ApiTicketAttachment[];
  editor?: { id: number; name: string } | null;
  updated_at: string;
  fixed_count?: number;
  not_fixed_count?: number;
}

export interface ApiTroubleshootingSnapshot {
  outcome?: TroubleshootingOutcome;
  guide_id: number | null;
  guide_title?: string | null;
  version: number | null;
  /** Objects since 2026-10-08; plain strings before (one guide per issue). */
  steps: Array<string | { body: string; files?: { id: number; name: string }[] }>;
  link_url: string | null;
  files?: { id: number; name: string }[];
  guides_shown?: { id: number; title: string; version: number }[];
  confirmed_by?: number | null;
}

/** How a store's troubleshooting ended. "fixed" never opens a ticket. */
export type TroubleshootingOutcome = "fixed" | "tried" | "none_match";
export type TroubleshootingTicketOutcome = Exclude<TroubleshootingOutcome, "fixed">;

export interface TroubleshootingStep {
  id: number;
  position: number;
  body: string;
  /** This step's own files (a photo of the breaker, a short video). */
  attachments: TicketAttachment[];
}

/**
 * What to try for one specific problem with a catalog issue ("Oven" ->
 * "Won't heat"). An issue can have several.
 */
export interface TroubleshootingGuide {
  id: number;
  issueId: number;
  /** The specific problem: "Won't heat". */
  title: string;
  /** In order: what to try first, then next. */
  steps: TroubleshootingStep[];
  linkUrl: string | null;
  /** Goes up on every save; sent back when a ticket is opened after it. */
  version: number;
  /** Files for the whole guide. */
  attachments: TicketAttachment[];
  editor: { id: number; name: string } | null;
  updatedAt: string;
  /** Times it fixed the problem, so no ticket was opened. */
  fixedCount: number;
  /** Tickets opened after trying it. */
  notFixedCount: number;
}

/** One issue and all its guides -- the troubleshooting page. */
export interface IssueTroubleshooting {
  issueId: number;
  title: string;
  description: string | null;
  guides: TroubleshootingGuide[];
}

/** The troubleshooting as the manager saw it, frozen onto the ticket issue. */
export interface TroubleshootingSnapshot {
  outcome: TroubleshootingOutcome;
  guideId: number | null;
  guideTitle: string | null;
  version: number | null;
  steps: { body: string; files: { id: number; name: string }[] }[];
  linkUrl: string | null;
  files: { id: number; name: string }[];
  /** Every guide the page listed, so "none of these" says what "these" were. */
  guidesShown: { id: number; title: string; version: number }[];
  confirmedBy: number | null;
}

export interface TroubleshootingGuideSummary {
  id: number;
  title: string;
  stepsCount: number;
  version: number;
  fixedCount: number;
  notFixedCount: number;
  updatedAt: string;
}

export interface TroubleshootingLibraryItem {
  issueId: number;
  title: string;
  description: string | null;
  guides: TroubleshootingGuideSummary[];
}

/** A guide as the editor sends it. Steps keep their id (and files) across edits. */
export interface TroubleshootingGuideInput {
  title: string;
  steps: { id?: number; body: string }[];
  link_url: string | null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Technician abilities                                                      */
/* ────────────────────────────────────────────────────────────────────────── */





