/* ────────────────────────────────────────────────────────────────────────── */
/*  Enums / Scalars                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export type TicketStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "complete"
  | "cancelled";
export type IssueStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "complete"
  | "deferred"
  | "cancelled";
export type Priority = "urgent" | "high" | "medium" | "low";

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
  attachments: TicketAttachment[];
  notes: TicketNote[];
  mistaken: boolean;
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
}

/** Part used during a repair, with cost, for one or more ticket issues. */
export interface TicketIssuePartUsage {
  id: number;
  ticketIssueId: number;
  partId: number;
  part: { id: number; name: string } | null;
  /** Numeric cost — API returns as decimal string; the service parses it. */
  cost: number;
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
  attachments: TicketAttachment[];
  notes: TicketNote[];
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: number;
  storeId: string;
  status: EnumField;
  /** All ticket notes (closing notes have a non-null `type`; generic notes are null). */
  notes: TicketNote[];
  attachments: TicketAttachment[];
  creator: UserRef | null;
  issueCount: number;
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

export interface CreateAttendanceEntryPayload {
  ticket_issue_ids: number[];
  technician_id: number;
  start_clock?: string;
  end_clock?: string;
  start_break?: string;
  end_break?: string;
  start_parts_run?: string;
  end_parts_run?: string;
}

export interface CreatePartUsagePayload {
  ticket_issue_ids: number[];
  part_id: number;
  cost: number;
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

export interface TicketsFilters {
  status?: TicketStatus | "";
  priority?: Priority | "";
  issue_id?: number;
  issue_status?: IssueStatus | "";
  part_cost_total_gt?: number;
  technician_id?: number;
  /** Include soft-deleted tickets: "with" = all, "only" = only deleted */
  trashed?: "with" | "only";
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
  /** Laravel returns decimal fields as strings (e.g. "49.99") */
  cost: string;
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
  attachments?: ApiTicketAttachment[];
  notes?: ApiTicketNote[];
  created_by?: number | null;
  creator?: { id: number; name: string; email: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ApiTicket {
  id: number;
  store_id: number | string;
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
