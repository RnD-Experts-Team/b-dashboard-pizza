/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance v2 — the ticket issue and its workflow (MAINTENANCE-V2 §2)   */
/* ────────────────────────────────────────────────────────────────────────── */

import type {
  ClockTime,
  Decimal,
  IdName,
  IsoDate,
  IsoDateTime,
  MEnum,
  Money,
  StoreRef,
  TicketAttachment,
  TicketNote,
  WithFiles,
} from "./common.types";
import type { PaymentLineType, PaidTo, TechnicianPurchase } from "./payments.types";
import type {
  TicketIssueStatusChange,
  TroubleshootingSnapshot,
  TroubleshootingTicketOutcome,
} from "@/types/maintenance-tickets.types";

/* ── Enums ───────────────────────────────────────────────────────────────── */

/** `App\Enums\IssueStatus`. The ticket status is derived from these and mirrors them. */
export type IssueStatus =
  | "new"
  | "in_review"
  | "waiting_on_store"
  | "inspection"
  | "waiting_approval"
  | "scheduled"
  | "work_done"
  | "closed"
  | "cancelled";

export type TicketStatusV2 = IssueStatus;

export type Priority = "urgent" | "high" | "medium" | "low";

/** How much the problem hurts the store. */
export type Impact = "none" | "slowed" | "partly_down" | "closed";

/**
 * How an issue ended. `deferred` exists in the backend enum but not in the
 * contract's `close` body — accepted on read, not offered on close.
 */
export type Resolution =
  | "repaired"
  | "fixed_by_troubleshooting"
  | "not_needed"
  | "replaced"
  | "deferred";

export type InspectionStatus = "scheduled" | "done" | "cancelled";
export type ApprovalDecision = "approved" | "rejected";
/** Who answered a store question / confirmed the fix. */
export type AnsweredVia = "store" | "specialist";
export type SchedulePurpose = "work" | "inspection";
export type VisitTaskStatus = "pending" | "done" | "not_done";

/** Whose turn it is, per status (see lib/maintenance-workflow). */
export type WhoseTurn = "office" | "store" | "technician" | "approver" | "office_or_store" | "none";

/** Approval levels (maintenance_settings.approval_levels). */
export type ApprovalLevelKey = "specialist" | "manager" | "management" | (string & {});

/** The close checklist keys. */
export type CloseChecklistKey =
  | "resolved"
  | "cost_recorded"
  | "invoice_attached"
  | "notes_completed";

/**
 * The action ids `workflow.next[].action` may carry. The contract does not
 * spell the ids out, so the known ones are listed (named after their
 * endpoints) and any other string is still accepted.
 */
export type WorkflowActionId =
  | "review"
  | "info_request"
  | "answer"
  | "inspection"
  | "inspection_result"
  | "approval_request"
  | "approval"
  | "schedule"
  | "move"
  | "work_done"
  | "confirmation"
  | "close"
  | "jump"
  | "cancel"
  | (string & {});

/* ── Parts of an issue ───────────────────────────────────────────────────── */

export interface AssignedTechnician {
  id: number;
  name: string;
  phone: string | null;
  category: IdName | string | null;
}

export interface InfoRequest {
  id: number;
  question: string;
  askedBy: { name: string } | null;
  createdAt: IsoDateTime;
  answer: string | null;
  answeredVia: AnsweredVia | null;
  answeredBy: { name: string } | null;
  answeredAt: IsoDateTime | null;
  mistaken: boolean;
  attachments?: TicketAttachment[];
}

export interface Inspection {
  id: number;
  technician: IdName | null;
  status: InspectionStatus;
  scheduledDate: IsoDate | null;
  scheduledTime: ClockTime | null;
  doneAt: IsoDateTime | null;
  findings: string | null;
  recommendedRepair: string | null;
  partsNeeded: string | null;
  estimatedCost: Money | null;
  attachments: TicketAttachment[];
  notes: TicketNote[];
  mistaken: boolean;
}

export interface Approval {
  id: number;
  amount: Money;
  level: ApprovalLevelKey;
  levelLabel: string;
  decision: ApprovalDecision;
  approverName: string;
  decidedAt: IsoDateTime;
  note: string | null;
  inspectionId: number | null;
  attachments: TicketAttachment[];
  mistaken: boolean;
}

/** One "move" of a booking. The contract says `delays [...]`; shape as today. */
export interface ScheduleDelay {
  id: number;
  newDate: IsoDate;
  newHour: ClockTime | null;
  reason: string;
  mistaken: boolean;
  createdAt: IsoDateTime;
}

/** A booking: a technician going out for an inspection or the work. */
export interface IssueSchedule {
  id: number;
  kind: SchedulePurpose;
  technician: IdName | null;
  date: IsoDate;
  time: ClockTime | null;
  expectedCompletionDate: IsoDate | null;
  tripId: number | null;
  mistaken: boolean;
  delays: ScheduleDelay[];
}

/** A visit to the store, from a trip stop. */
export interface IssueVisit {
  tripId: number;
  tripStopId: number;
  technician: IdName | null;
  storeNumber: string | null;
  arrivedAt: IsoDateTime | null;
  leftAt: IsoDateTime | null;
  taskStatus: VisitTaskStatus;
  doneAt: IsoDateTime | null;
  notDoneReason: string | null;
  purpose: SchedulePurpose;
}

/** Sums of non-mistaken payment lines linked to the issue, by kind. */
export interface IssueCosts {
  /** Latest non-mistaken inspection estimate. */
  estimated: Money | null;
  /** Latest approved approval amount. */
  approved: Money | null;
  labor: Money;
  inspection: Money;
  parts: Money;
  gas: Money;
  other: Money;
  totalActual: Money;
  /** Technician purchases on this issue not paid back yet. */
  unpaidPurchases: Money;
  /** Parts used from storage on this issue, at cost. */
  stockUsedValue: Money;
}

/** A payment line linked to the issue. */
export interface IssuePaymentLink {
  paymentId: number;
  lineId: number;
  paidAt: IsoDate;
  paidTo: PaidTo;
  type: PaymentLineType;
  amount: Money;
  invoiceNumber: string | null;
  hasInvoice: boolean;
  /** The files attached to that payment. */
  invoices?: IssueInvoiceFile[];
}

/** One file on a payment, as the issue's Costs tab lists it. */
export interface IssueInvoiceFile {
  id: number;
  originalName: string;
  url: string;
}

/** Parts used from storage on the issue. */
export interface IssueStockUse {
  movementId: number;
  movedAt: IsoDateTime;
  part: IdName;
  quantity: Decimal;
  value: Money;
  storageLocation: IdName | null;
  serials: string[];
}

export interface IssueWarranty {
  id: number;
  body: string | null;
  expiryDate: IsoDate | null;
  mistaken: boolean;
  attachments?: TicketAttachment[];
  createdAt?: IsoDateTime;
}

export interface WorkflowNextAction {
  action: WorkflowActionId;
  label: string;
  /** The first one is the primary. */
  primary: boolean;
}

export interface CloseChecklistItem {
  key: CloseChecklistKey;
  label: string;
  done: boolean;
}

export interface ApprovalLevelFor {
  amount: Money;
  level: ApprovalLevelKey;
  label: string;
}

export interface IssueWorkflow {
  /** 1–11, see lib/maintenance-workflow/steps.ts. */
  step: number;
  status: IssueStatus;
  /** Actions valid now; the first one is primary. */
  next: WorkflowNextAction[];
  /** The close checklist. */
  checklist: CloseChecklistItem[];
  /** The approval level the current estimate needs. */
  approvalLevelFor: ApprovalLevelFor | null;
}

/** The kinds the merged timeline carries; others are accepted as-is. */
export type TimelineKind =
  | "status_change"
  | "info_request"
  | "info_answer"
  | "inspection"
  | "approval"
  | "schedule"
  | "visit"
  | "payment"
  | "purchase"
  | "stock_used"
  | "note"
  | (string & {});

export interface TimelineEntry {
  at: IsoDateTime;
  kind: TimelineKind;
  text: string;
  actor: string | IdName | null;
  /** Present on notes: MOS-only notes show a lock. */
  isPrivate?: boolean;
}

/* ── The issue ───────────────────────────────────────────────────────────── */

export interface TicketIssueV2 {
  id: number;
  ticketId: number;
  /** Display title: the catalog issue's title, or other_title. */
  title: string;
  issue: { id: number; title: string } | null;
  otherTitle: string | null;
  description: string | null;
  priority: MEnum<Priority>;
  assignedPriority: MEnum<Priority> | null;
  impact: MEnum<Impact> | null;
  contactName: string | null;
  contactPhone: string | null;
  status: MEnum<IssueStatus>;
  step: number;
  targetCompletionAt: IsoDateTime | null;
  nextAction: string | null;
  workPerformed: string | null;
  resolution: MEnum<Resolution> | null;
  storeConfirmedAt: IsoDateTime | null;
  storeConfirmedWorking: boolean | null;
  storeConfirmedVia: AnsweredVia | null;
  closedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt?: IsoDateTime;
  creator: IdName | null;

  technicians: AssignedTechnician[];
  infoRequests: InfoRequest[];
  inspections: Inspection[];
  approvals: Approval[];
  schedules: IssueSchedule[];
  visits: IssueVisit[];
  costs: IssueCosts | null;
  payments: IssuePaymentLink[];
  purchases: TechnicianPurchase[];
  stockUsed: IssueStockUse[];
  warranties: IssueWarranty[];
  workflow: IssueWorkflow | null;
  statusChanges: TicketIssueStatusChange[];
  notes: TicketNote[];
  attachments: TicketAttachment[];
  timeline: TimelineEntry[];

  /** Troubleshooting, as today. */
  troubleshootingConfirmedAt: IsoDateTime | null;
  troubleshootingOutcome: TroubleshootingTicketOutcome | null;
  troubleshootingGuideId: number | null;
  troubleshootingSnapshot: TroubleshootingSnapshot | null;
}

/** A NEW trip link, returned once (only when a trip was created). */
export interface TripLinkIssued {
  urlToken: string;
  expiresAfterHours: number;
  /** Present on workflow actions (the trip the booking landed on). */
  tripId?: number;
}

/** What every workflow action returns: the issue, plus a trip link when one was issued. */
export interface WorkflowResult {
  issue: TicketIssueV2;
  tripLink: TripLinkIssued | null;
}

/* ── Action payloads ─────────────────────────────────────────────────────── */

export interface ReviewPayload {
  targetCompletionAt?: IsoDateTime | null;
  nextAction?: string | null;
  assignedPriority?: Priority | null;
}

export interface InfoRequestPayload extends WithFiles {
  question: string;
}

export interface InfoAnswerPayload extends WithFiles {
  answer: string;
  /** Defaults to "store" upstream. */
  via?: AnsweredVia;
}

export interface BookInspectionPayload {
  technicianId: number;
  scheduledDate: IsoDate;
  scheduledTime?: ClockTime | null;
  instructions?: string | null;
}

export interface InspectionResultPayload extends WithFiles {
  findings: string;
  recommendedRepair?: string | null;
  partsNeeded?: string | null;
  estimatedCost?: string | number | null;
}

export interface ApprovalRequestPayload {
  amount: string | number;
  inspectionId?: number | null;
}

export interface RecordApprovalPayload extends WithFiles {
  amount: string | number;
  decision: ApprovalDecision;
  approverName: string;
  note?: string | null;
  inspectionId?: number | null;
}

export interface ScheduleWorkPayload {
  technicianId: number;
  date: IsoDate;
  time?: ClockTime | null;
  expectedCompletionDate?: IsoDate | null;
  instructions?: string | null;
}

export interface MoveSchedulePayload {
  date: IsoDate;
  time?: ClockTime | null;
  reason: string;
}

export interface WorkDonePayload extends WithFiles {
  workPerformed: string;
  warranty?: { body: string; expiryDate: IsoDate } | null;
}

export interface ConfirmationPayload {
  working: boolean;
  note?: string | null;
  via: AnsweredVia;
}

/** Resolutions the close dialog offers. */
export type CloseResolution = Exclude<Resolution, "deferred">;

export interface ClosePayload {
  resolution: CloseResolution;
  finalNote?: string | null;
  whatWeLearned?: string | null;
  /** Required when a checklist item is not done; logged on the status change. */
  overrideReason?: string | null;
}

export interface JumpPayload {
  status: IssueStatus;
  reason: string;
}

export interface CancelIssuePayload {
  reason: string;
}

/** Per-issue additions to ticket creation (v2). */
export interface CreateIssueV2Fields {
  impact?: Impact;
  contactName?: string;
  contactPhone?: string;
}

/* ── Issue lookup (the pickers) ──────────────────────────────────────────── */

/** GET ticket-issues: a light row per issue across every store, newest first — never the full read. */
export interface TicketIssueLookupRow {
  id: number;
  ticketId: number;
  title: string;
  status: IssueStatus;
  statusLabel: string;
  priority: MEnum<Priority> | null;
  store: StoreRef | null;
  otherStore: string | null;
}

export interface TicketIssueLookupFilters {
  /** Catalog title, free-text title, description, or the ticket id (a leading # allowed). */
  search?: string;
  /** A store number. */
  store?: string;
  statuses?: readonly IssueStatus[];
  /** Default 20, at most 100. */
  limit?: number;
}
