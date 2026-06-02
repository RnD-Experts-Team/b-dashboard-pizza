/* ────────────────────────────────────────────────────────────────────────── */
/*  Enums / Scalars                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export type TicketStatus = "pending" | "assigned" | "in_progress" | "complete";
export type IssueStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "complete"
  | "deferred";
export type Priority = "urgent" | "high" | "medium" | "low";

/**
 * The API returns enum fields as { value: "...", label: "..." }.
 * When posting, send the raw `value` string.
 */
export interface EnumField {
  value: string;
  label: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Catalog types (reference data – loaded once)                           */
/* ────────────────────────────────────────────────────────────────────────── */

export interface CatalogIssue {
  id: number;
  title: string;
  description: string | null;
  deletedAt: string | null;
}

export interface CatalogTechnician {
  id: number;
  name: string;
  phone: string | null;
  categoryId: number | null;
  categoryName: string | null;
  deletedAt: string | null;
}

export interface CatalogPart {
  id: number;
  name: string;
  description: string | null;
  deletedAt: string | null;
}

export interface CatalogCategory {
  id: number;
  name: string;
  description: string | null;
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
  createdAt: string;
}

export interface TicketAssignment {
  id: number;
  assignedDate: string;
  assignedHour: string | null;
  technicians: CatalogTechnician[];
  delays: TicketAssignmentDelay[];
  createdAt: string;
}

export interface TicketIssueStatusChange {
  id: number;
  status: EnumField;
  changedBy: string | null;
  reason: string | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: number;
  storeId: string;
  status: EnumField;
  finalNote: string | null;
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
}

export interface CreateTicketPayload {
  issues: CreateTicketIssueRow[];
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

export interface FinalNotePayload {
  final_note: string | null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Filters                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface TicketsFilters {
  status?: TicketStatus | "";
  priority?: Priority | "";
  created_from?: string;
  created_to?: string;
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
}

export interface ApiCatalogTechnician {
  id: number;
  name: string;
  phone: string | null;
  category_id: number | null;
  category_name: string | null;
  deleted_at: string | null;
}

export interface ApiCatalogPart {
  id: number;
  name: string;
  description: string | null;
  deleted_at: string | null;
}

export interface ApiCatalogCategory {
  id: number;
  name: string;
  description: string | null;
}

export interface ApiTicketAssignmentDelay {
  id: number;
  assignment_id: number;
  new_date: string;
  new_hour: string | null;
  reason: string;
  created_at: string;
}

export interface ApiTicketAssignment {
  id: number;
  assigned_date: string;
  assigned_hour: string | null;
  technicians: ApiCatalogTechnician[];
  delays: ApiTicketAssignmentDelay[];
  created_at: string;
}

export interface ApiTicketIssueStatusChange {
  id: number;
  status: ApiEnumField;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface ApiTicketIssue {
  id: number;
  ticket_id: number;
  issue_id: number | null;
  issue_title: string | null;
  other_title: string | null;
  priority: ApiEnumField;
  status: ApiEnumField;
  description: string | null;
  parent_id: number | null;
  assignments: ApiTicketAssignment[];
  status_changes: ApiTicketIssueStatusChange[];
  technicians: ApiCatalogTechnician[];
  children: ApiTicketIssue[];
  created_at: string;
  updated_at: string;
}

export interface ApiTicket {
  id: number;
  store_id: number | string;
  status: ApiEnumField;
  final_note: string | null;
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
