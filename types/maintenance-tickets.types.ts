/* ────────────────────────────────────────────────────────────────────────── */
/*  Enums / Scalars                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export type TicketStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "waiting"
  | "complete"
  | "cancelled";
export type IssueStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "waiting"
  | "complete"
  | "deferred"
  | "cancelled";
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

/** Where a part came from. `from_storage` draws stock in the same transaction. */
export type PartUsageSource = "purchased" | "from_storage";

/** Who paid for a part. `us` means nobody is owed, so it is not payable. */
export type PartUsagePayer = "us" | "technician";

/**
 * One daily pay claim against a record. Being on a pay sheet IS being paid.
 * `amount` is part-usages only; attendance entries carry `minutes` instead.
 */
export interface RecordPaymentClaim {
  dailyPayPaymentId: number;
  dailyPayEntryId: number;
  dailyPayLineId: number | null;
  date: string;
  technicianId: number;
  technician: { id: number; name: string } | null;
  /** Part usages only. */
  amount: number | null;
  /**
   * Attendance entries only: the minutes THIS payment actually counted, which
   * can differ from the entry's own durations when several payments touch it.
   */
  minutes: AttendanceMinutes | null;
}

/**
 * Payment status on an attendance entry or part usage.
 *
 * The whole block is `null` when the claims were not loaded; `payments` is `[]`
 * when the record is genuinely unpaid. Never collapse those two.
 */
export interface RecordPaymentBlock {
  status: PaymentStatusField;
  payments: RecordPaymentClaim[];
}

/**
 * Rolled-up payment status on a ticket issue.
 *
 * ANYTHING STILL OWED DOMINATES: an issue reads `unpaid` until the last of its
 * payables is settled, so an issue whose hours are paid but whose late receipt
 * is not still shows unpaid. That is deliberate — it is the state finance
 * cares about. An issue that costs nobody anything reads `not_payable`.
 */
export interface IssuePaymentBlock {
  status: PaymentStatusField;
  dailyPayLineIds: number[];
}

/** Minutes per bucket. Authoritative; `hours` is the same figure rounded. */
export interface AttendanceMinutes {
  work: number;
  travel: number;
  break: number;
  parts_run: number;
}

export interface AttendanceHours {
  work: number;
  travel: number;
  break: number;
  parts_run: number;
}

/**
 * Server-computed durations for an attendance entry. Nothing is stored — this
 * is derived from the clocks on every read.
 *
 * `work` is NET: break, parts-run and travel intervals that fall inside the
 * clock window are merged and subtracted once. The other three are reported at
 * full recorded length, because they are their own line items.
 */
export interface AttendanceDurations {
  minutes: AttendanceMinutes;
  hours: AttendanceHours;
  /**
   * `incomplete_pair:<bucket>` (counted as zero), `inverted_pair:<bucket>`
   * (counted as zero), `implausible_pair:<bucket>` (clamped to 24h).
   */
  warnings: string[];
}

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
  deletedAt: string | null;
  notes?: TicketNote[];
  attachments?: TicketAttachment[];
}

export interface CatalogTechnician {
  id: number;
  name: string;
  phone: string | null;
  categoryId: number | null;
  categoryName: string | null;
  deletedAt: string | null;
  creator: UserRef | null;
  notes?: TicketNote[];
  attachments?: TicketAttachment[];
}

export interface CatalogPart {
  id: number;
  name: string;
  description: string | null;
  deletedAt: string | null;
  notes?: TicketNote[];
  attachments?: TicketAttachment[];
}

export interface CatalogCategory {
  id: number;
  name: string;
  description: string | null;
  notes?: TicketNote[];
  attachments?: TicketAttachment[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Ticket + Issue (client camelCase)                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export interface TicketAssignmentDelay {
  id: number;
  assignmentId: number;
  newDate: string;
  newHour: string | null;
  reason: string;
  mistaken: boolean;
  createdAt: string;
}

export interface TicketAssignment {
  id: number;
  assignedDate: string;
  assignedHour: string | null;
  technicians: CatalogTechnician[];
  delays: TicketAssignmentDelay[];
  attachments: TicketAttachment[];
  notes: TicketNote[];
  mistaken: boolean;
  creator: UserRef | null;
  createdAt: string;
}

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
  attachments: TicketAttachment[];
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A diagnosis entry targeting one or more ticket issues.
 * Records are immutable — mark `mistaken` instead of deleting.
 */
export interface TicketIssueDiagnosis {
  id: number;
  ticketIssueId: number;
  body: string | null;
  attachments: TicketAttachment[];
  notes: TicketNote[];
  mistaken: boolean;
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
}

/** Technician time-tracking entry for one or more ticket issues. */
export interface TicketIssueAttendance {
  id: number;
  ticketIssueId: number;
  technicianId: number;
  technician: { id: number; name: string } | null;
  startClock: string | null;
  endClock: string | null;
  startBreak: string | null;
  endBreak: string | null;
  startPartsRun: string | null;
  endPartsRun: string | null;
  /** Travel clocks. Any subset of the four pairs may be set — deliberate. */
  startTravel: string | null;
  endTravel: string | null;
  /** Server-computed; null only when the API predates the durations block. */
  durations: AttendanceDurations | null;
  /** Null when the payment claims were not loaded. */
  payment: RecordPaymentBlock | null;
  attachments: TicketAttachment[];
  notes: TicketNote[];
  mistaken: boolean;
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
}

/**
 * Part used during a repair, for one or more ticket issues.
 *
 * Was a flat `{ part_id, cost }`; now quantity × unit cost, with a source, a
 * payer, and optional returns. `cost` is COMPUTED server-side and is never
 * sent by the client.
 *
 * `cost` vs `net_cost`: `cost` is the gross outlay and is what the
 * `part_cost_single_gt` / `part_cost_total_gt` ticket filters sum. `net_cost`
 * is what the payer is actually out of pocket after returns, and is what a
 * daily pay reimburses. On 10 at £5 with 4 returned: cost 50.00,
 * net_cost 30.00, net_quantity 6.00.
 */
export interface TicketIssuePartUsage {
  id: number;
  ticketIssueId: number;
  partId: number;
  part: { id: number; name: string } | null;
  quantity: number;
  unitCost: number;
  /** Gross outlay: quantity × unit cost. Computed server-side. */
  cost: number;
  /** Quantity kept after returns. */
  netQuantity: number;
  /** What the payer is actually out of pocket after returns. */
  netCost: number;
  /** Null on pre-v2 rows — do NOT synthesize a value, show nothing. */
  source: EnumField | null;
  paidBy: EnumField | null;
  /** True when somebody other than us paid and is therefore owed. */
  reimbursable: boolean;
  paidByTechnicianId: number | null;
  paidByTechnician: { id: number; name: string } | null;
  /** The shelf the part came off, when source is `from_storage`. */
  storageLocationId: number | null;
  storageLocation: StorageLocationRef | null;
  returnedQuantity: number | null;
  returnedToStorageLocationId: number | null;
  returnedToStorageLocation: StorageLocationRef | null;
  /** Ledger rows this usage wrote. `[]`, never null. */
  stockMovementIds: number[];
  /** Null when the payment claims were not loaded. */
  payment: RecordPaymentBlock | null;
  /**
   * True for a legacy `{ part_id, cost }` row with no quantity. Such a row
   * must render as a bare cost — showing a fabricated "1 ×" would be inventing
   * data we do not have.
   */
  isLegacy: boolean;
  attachments: TicketAttachment[];
  notes: TicketNote[];
  mistaken: boolean;
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
}

/** Pay record for a technician linked to one or more ticket issues. */
export interface TicketIssuePayEntry {
  id: number;
  ticketIssueId: number;
  technicianId: number;
  technician: { id: number; name: string } | null;
  basePay: number | null;
  performancePay: number | null;
  drivingBasePay: number | null;
  drivingPerformancePay: number | null;
  /** Hours driven (API sends as decimal string; service parses it). */
  drivingTime: number | null;
  milesDriven: number | null;
  perMileRate: number | null;
  attachments: TicketAttachment[];
  notes: TicketNote[];
  mistaken: boolean;
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
}

/** Warranty claim record for one or more ticket issues. */
export interface TicketIssueWarranty {
  id: number;
  ticketIssueId: number;
  body: string | null;
  /** Required since v2.0 (YYYY-MM-DD). */
  expiryDate: string | null;
  attachments: TicketAttachment[];
  notes: TicketNote[];
  mistaken: boolean;
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
}

export interface TicketIssue {
  id: number;
  ticketId: number;
  issueId: number | null;
  issueTitle: string | null;
  otherTitle: string | null;
  priority: EnumField;
  /** Independent priority set later by staff (distinct from `priority`, chosen at creation). Null until set. */
  assignedPriority: EnumField | null;
  status: EnumField;
  description: string | null;
  parentId: number | null;
  assignments: TicketAssignment[];
  statusChanges: TicketIssueStatusChange[];
  technicians: CatalogTechnician[];
  children: TicketIssue[];
  diagnoses: TicketIssueDiagnosis[];
  attendanceEntries: TicketIssueAttendance[];
  partUsages: TicketIssuePartUsage[];
  payEntries: TicketIssuePayEntry[];
  warranties: TicketIssueWarranty[];
  /**
   * Rolled-up payment status. ANYTHING STILL OWED DOMINATES — see
   * IssuePaymentBlock. Null when the claims were not loaded.
   */
  payment: IssuePaymentBlock | null;
  attachments: TicketAttachment[];
  notes: TicketNote[];
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
  updatedAt: string;
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

export interface TicketIssuesResponse {
  data: TicketIssue[];
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
}

export interface CreateTicketPayload {
  issues: CreateTicketIssueRow[];
  /** Optional ticket-level notes to attach at creation time */
  notes?: Array<{ body: string; type?: string | null }>;
  /** Files to attach directly to the ticket (multipart only) */
  files?: File[];
  type?: TicketType;
}

export interface AssignIssuesPayload {
  ticket_issue_ids: number[];
  technician_ids: number[];
  assigned_date: string; // YYYY-MM-DD
  assigned_hour?: string; // HH:MM
}

export interface StatusChangePayload {
  ticket_issue_ids: number[];
  status: IssueStatus;
}

export interface DeferPayload {
  reason: string;
}

export interface CancelPayload {
  reason: string;
}

export interface WaitPayload {
  reason: string;
}

/** Re-links a ticket-issue line to a different catalog issue — nothing else on the line changes. */
export interface RelinkIssuePayload {
  issue_id: number;
}

/** Sets (or clears, via null) the independent assigned_priority on a ticket-issue line. */
export interface AssignedPriorityPayload {
  priority: Priority | null;
}

/** A typed closing note appended to a ticket (multipart; supports files). */
export interface FinalNotePayload {
  body: string;
  type: NoteType;
}

/** Generic free-text note for any entity (multipart; supports files). */
export interface CreateNotePayload {
  body: string;
  type?: string;
}

export interface CreateDiagnosisPayload {
  ticket_issue_ids: number[];
  body?: string;
}

/** A note sent alongside the record it belongs to, in the same request. */
export interface InlineNotePayload {
  body: string;
  type?: string;
  files?: File[];
}

export interface CreateAttendanceEntryPayload {
  /**
   * ATTENDANCE ONLY: the nested endpoint now accepts issues belonging to OTHER
   * tickets, so long as at least one belongs to this one. That is the fix for
   * "drove to one store, worked three tickets" — one entry, not three.
   *
   * The relaxation does NOT extend to parts, assignments or diagnoses, which
   * still require every issue to belong to the ticket.
   */
  ticket_issue_ids: number[];
  technician_id: number;
  start_clock?: string;
  end_clock?: string;
  start_break?: string;
  end_break?: string;
  start_parts_run?: string;
  end_parts_run?: string;
  start_travel?: string;
  end_travel?: string;
  notes?: InlineNotePayload[];
}

/**
 * `cost` is deliberately absent: the server computes it as
 * quantity × unit_cost and does not accept it from the client.
 */
export interface CreatePartUsagePayload {
  /** Must ALL belong to this ticket — unlike attendance. */
  ticket_issue_ids: number[];
  part_id: number;
  quantity: number;
  /** The price of ONE unit, not the total. */
  unit_cost: number;
  source: PartUsageSource;
  paid_by: PartUsagePayer;
  /** Required when paid_by is "technician". */
  paid_by_technician_id?: number;
  /** Required when source is "from_storage". */
  storage_location_id?: number;
  /** Must not exceed `quantity`. */
  returned_quantity?: number;
  /** Required when returning anything. */
  returned_to_storage_location_id?: number;
  /** Vendor and receipt details go here — there is deliberately no vendor column. */
  notes?: InlineNotePayload[];
}

export interface CreatePayEntryPayload {
  ticket_issue_ids: number[];
  technician_id: number;
  base_pay?: number;
  performance_pay?: number;
  driving_base_pay?: number;
  driving_performance_pay?: number;
  driving_time?: number;
  miles_driven?: number;
  per_mile_rate?: number;
}

export interface CreateWarrantyPayload {
  ticket_issue_ids: number[];
  body?: string;
  /** Required since v2.0 (YYYY-MM-DD). */
  expiry_date: string;
}

export interface AttachTechniciansPayload {
  ticket_issue_ids: number[];
  technician_ids: number[];
}

export interface DelayAssignmentPayload {
  new_date: string;
  new_hour?: string;
  reason: string;
}

export interface ChangeAssignmentTechniciansPayload {
  technician_ids: number[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Filters                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * What GET /tickets/{ticket}/issues returns: the issues, AND the ticket.
 *
 * The store-scoped twin does not need to send the ticket -- that URL already
 * said which store it was. This one has no store segment by design, so the
 * ticket rides along; without it a page reached by link has no way to learn the
 * `store_number` that every subsequent write binds on.
 */
export interface TicketWithIssuesResponse {
  data: TicketIssue[];
  ticket: Ticket;
}

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
  deleted_at: string | null;
  notes?: ApiTicketNote[];
  attachments?: ApiTicketAttachment[];
}

export interface ApiCatalogTechnician {
  id: number;
  name: string;
  phone?: string | null;
  category_id: number | null;
  category: { id: number; name: string } | null;
  deleted_at?: string | null;
  created_by?: number | null;
  creator?: { id: number; name: string; email: string } | null;
  notes?: ApiTicketNote[];
  attachments?: ApiTicketAttachment[];
}

export interface ApiCatalogPart {
  id: number;
  name: string;
  description: string | null;
  deleted_at: string | null;
  notes?: ApiTicketNote[];
  attachments?: ApiTicketAttachment[];
}

export interface ApiCatalogCategory {
  id: number;
  name: string;
  description: string | null;
  notes?: ApiTicketNote[];
  attachments?: ApiTicketAttachment[];
}

export interface ApiTicketAssignmentDelay {
  id: number;
  assignment_id: number;
  new_date: string;
  new_hour: string | null;
  reason: string;
  mistaken?: boolean;
  created_at: string;
}

export interface ApiTicketAssignment {
  id: number;
  assigned_date: string;
  assigned_hour: string | null;
  ticket_issue_ids: number[] | null;
  delays: ApiTicketAssignmentDelay[];
  attachments?: ApiTicketAttachment[];
  notes?: ApiTicketNote[];
  mistaken?: boolean;
  created_by?: number | null;
  creator?: { id: number; name: string; email: string } | null;
  created_at: string;
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
  attachments?: ApiTicketAttachment[];
  created_by: number | null;
  creator: { id: number; name: string; email: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ApiTicketIssueDiagnosis {
  id: number;
  ticket_issue_id: number;
  body: string | null;
  attachments: ApiTicketAttachment[];
  notes?: ApiTicketNote[];
  mistaken: boolean;
  created_by?: number | null;
  creator?: { id: number; name: string; email?: string | null } | null;
  created_at: string;
}

export interface ApiAttendanceDurations {
  minutes?: Partial<AttendanceMinutes> | null;
  hours?: Partial<AttendanceHours> | null;
  warnings?: string[] | null;
}

export interface ApiRecordPaymentClaim {
  daily_pay_payment_id: number;
  daily_pay_entry_id: number;
  daily_pay_line_id?: number | null;
  date: string;
  technician_id: number;
  technician?: { id: number; name: string } | null;
  /** Part usages only. */
  amount?: string | null;
  /** Attendance entries only. */
  minutes?: Partial<AttendanceMinutes> | null;
}

export interface ApiRecordPaymentBlock {
  status: { value: string; label: string };
  payments?: ApiRecordPaymentClaim[] | null;
}

export interface ApiIssuePaymentBlock {
  status: { value: string; label: string };
  daily_pay_line_ids?: number[] | null;
}

export interface ApiStorageLocationRef {
  id: number;
  name: string;
  code?: string | null;
}

export interface ApiTicketIssueAttendance {
  id: number;
  ticket_issue_id: number;
  technician_id: number;
  technician: { id: number; name: string } | null;
  start_clock: string | null;
  end_clock: string | null;
  start_break: string | null;
  end_break: string | null;
  start_parts_run: string | null;
  end_parts_run: string | null;
  start_travel?: string | null;
  end_travel?: string | null;
  durations?: ApiAttendanceDurations | null;
  payment?: ApiRecordPaymentBlock | null;
  attachments: ApiTicketAttachment[];
  notes?: ApiTicketNote[];
  mistaken: boolean;
  created_by?: number | null;
  creator?: { id: number; name: string; email?: string | null } | null;
  created_at: string;
}

export interface ApiTicketIssuePartUsage {
  id: number;
  ticket_issue_id: number;
  part_id: number;
  part: { id: number; name: string; description: string | null } | null;
  /**
   * Laravel returns decimal fields as strings (e.g. "49.99").
   *
   * Every v2 field below is OPTIONAL so that a legacy row — or a
   * partially-deployed upstream — still parses. See transformPartUsage for the
   * fallback table and why `source` / `paid_by` fall back to null rather than
   * to a fabricated value.
   */
  cost: string;
  quantity?: string | null;
  unit_cost?: string | null;
  net_quantity?: string | null;
  net_cost?: string | null;
  source?: { value: string; label: string } | null;
  paid_by?: { value: string; label: string } | null;
  reimbursable?: boolean | null;
  paid_by_technician_id?: number | null;
  paid_by_technician?: { id: number; name: string } | null;
  storage_location_id?: number | null;
  storage_location?: ApiStorageLocationRef | null;
  returned_quantity?: string | null;
  returned_to_storage_location_id?: number | null;
  returned_to_storage_location?: ApiStorageLocationRef | null;
  stock_movement_ids?: number[] | null;
  payment?: ApiRecordPaymentBlock | null;
  attachments: ApiTicketAttachment[];
  notes?: ApiTicketNote[];
  mistaken: boolean;
  created_by?: number | null;
  creator?: { id: number; name: string; email?: string | null } | null;
  created_at: string;
}

export interface ApiTicketIssuePayEntry {
  id: number;
  ticket_issue_id: number;
  technician_id: number;
  technician?: { id: number; name: string } | null;
  base_pay: string | null;
  performance_pay: string | null;
  driving_base_pay: string | null;
  driving_performance_pay: string | null;
  driving_time: string | null;
  miles_driven: string | null;
  per_mile_rate: string | null;
  attachments?: ApiTicketAttachment[];
  notes?: ApiTicketNote[];
  mistaken: boolean;
  created_by?: number | null;
  creator?: { id: number; name: string; email?: string | null } | null;
  created_at: string;
}

export interface ApiTicketIssueWarranty {
  id: number;
  ticket_issue_id: number;
  body: string | null;
  expiry_date?: string | null;
  attachments: ApiTicketAttachment[];
  notes?: ApiTicketNote[];
  mistaken: boolean;
  created_by?: number | null;
  creator?: { id: number; name: string; email?: string | null } | null;
  created_at: string;
}

export interface ApiTicketIssue {
  id: number;
  ticket_id: number;
  issue_id: number | null;
  issue: { id: number; title: string; description: string | null } | null;
  display_title: string | null;
  other_title: string | null;
  priority: ApiEnumField;
  assigned_priority: ApiEnumField | null;
  status: ApiEnumField;
  description: string | null;
  parent_id: number | null;
  assignments: ApiTicketAssignment[];
  status_changes: ApiTicketIssueStatusChange[];
  technicians: ApiCatalogTechnician[];
  children: ApiTicketIssue[];
  diagnoses: ApiTicketIssueDiagnosis[];
  attendance_entries: ApiTicketIssueAttendance[];
  part_usages: ApiTicketIssuePartUsage[];
  pay_entries: ApiTicketIssuePayEntry[];
  warranties: ApiTicketIssueWarranty[];
  payment?: ApiIssuePaymentBlock | null;
  attachments?: ApiTicketAttachment[];
  notes?: ApiTicketNote[];
  created_by?: number | null;
  creator?: { id: number; name: string; email: string } | null;
  created_at: string;
  updated_at: string;
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
  issues?: Array<{ id: number; display_title?: string | null; title?: string | null; catalog_issue?: { title?: string | null } | null }>;
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

export interface ApiTicketIssuesResponse {
  data: ApiTicketIssue[];
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
