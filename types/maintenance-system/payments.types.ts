/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance — payments, unpaid work, technician purchases (§4)        */
/* ────────────────────────────────────────────────────────────────────────── */

import type {
  Decimal,
  IdName,
  IsoDate,
  IsoDateTime,
  IssueRef,
  Money,
  Page,
  PageMeta,
  StoreRef,
  TicketAttachment,
  TicketNote,
} from "./common.types";
import type { UnpaidSession } from "./trips.types";
import type { InspectionStatus } from "./workflow.types";

/** `App\Enums\PaymentLineType`. */
export type PaymentLineType = "hourly" | "fixed" | "inspection" | "parts" | "gas" | "other";

/** `App\Enums\PaymentMethod`, the old fixed list (older rows only). null = not recorded. */
export type PaymentMethod = "cash" | "check" | "card" | "bank_transfer" | "zelle" | "other";

/** One entry of the editable "How we paid" list (GET /payment-methods). */
export interface PaymentMethodOption {
  id: number;
  name: string;
  sort: number;
  /** How many payments use it (a used one cannot be deleted). */
  paymentsCount: number | null;
}

/** A payment goes to exactly one technician XOR one supplier. */
export type PaidToType = "technician" | "supplier";

/** Where bought parts go. */
export type PartsDestination = "storage" | "ticket";

export interface PaidTo {
  type: PaidToType;
  id: number;
  name: string;
  /** Technicians only. */
  category?: IdName | string | null;
}

/* ── List ────────────────────────────────────────────────────────────────── */

/** payment: money we paid. refund: money that came back for a payment (negative total). */
export type PaymentKind = "payment" | "refund";

/** On a refund: the payment it gives money back for. */
export interface RefundOf {
  id: number;
  paidAt: IsoDate;
  total: Money;
}

export interface PaymentListRow {
  id: number;
  kind: PaymentKind;
  /** Refunds only. */
  refundOf: RefundOf | null;
  /** Refunds only: why the money came back. */
  refundReason: string | null;
  /** For a refund: when the money came back. */
  paidAt: IsoDate;
  paidTo: PaidTo;
  /** How we paid, from the editable list. */
  paymentMethod: { id: number; name: string } | null;
  reference: string | null;
  invoiceNumber: string | null;
  /** Negative on a refund. */
  total: Money;
  /** Payments: what live refunds gave back ("0.00" when none). Null on a refund. */
  refundedTotal: Money | null;
  /** What it cost in the end: total minus refundedTotal (a refund: its own total). */
  netTotal: Money;
  lineCount: number;
  /** Store numbers. */
  stores: string[];
  types: PaymentLineType[];
  hasInvoice: boolean;
  mistaken: boolean;
  /** The body of its `mistaken` note, or null. */
  mistakenReason?: string | null;
  createdAt: IsoDateTime;
}

export interface PaymentListMeta extends PageMeta {
  totals: { count: number; total: Money };
}

export type PaymentList = Page<PaymentListRow, PaymentListMeta>;

export interface PaymentFilters {
  from?: IsoDate;
  to?: IsoDate;
  technicianId?: number;
  supplierId?: number;
  categoryId?: number;
  store?: string;
  type?: PaymentLineType;
  /** Matches invoice number, reference, names. */
  search?: string;
  includeMistaken?: boolean;
  /** Only payments or only refunds; both by default (the totals net refunds). */
  kind?: PaymentKind;
  page?: number;
  perPage?: number;
}

/* ── One payment ─────────────────────────────────────────────────────────── */

export interface PlaceAddressLine {
  levelId: number;
  valueId: number;
}

/** A parts-into-storage line's spot as read back: the stock balance's address NOW, with names. */
export interface PaymentLinePlace extends PlaceAddressLine {
  level?: string;
  value?: string;
}

export interface PaymentLine {
  id: number;
  /** On a refund line: the line of the payment it gives money back for. */
  refundOfLineId: number | null;
  /** On a payment line: what live refunds gave back for it, and what can still be refunded (null on refund lines). */
  refunded: Money | null;
  refundable: Money | null;
  type: PaymentLineType;
  typeLabel?: string;
  store: StoreRef | null;
  otherStore: string | null;
  storageLocation: IdName | null;
  description: string | null;
  amount: Money;
  /** hourly */
  hours: Decimal | null;
  hoursOverridden?: boolean;
  rate: Money | null;
  tripSessions: { id: number; clockIn: IsoDateTime; clockOut: IsoDateTime | null; paidMinutes: number }[];
  /** parts */
  part: IdName | null;
  quantity: Decimal | null;
  unitCost: Money | null;
  boughtFrom: IdName | null;
  destination: PartsDestination | null;
  /** Parts into storage: where that part sits in the location now ([] = nobody said); null on every other line. */
  place?: PaymentLinePlace[] | null;
  stockMovementId: number | null;
  serials: string[];
  technicianPurchases: TechnicianPurchase[];
  /** gas */
  miles: Decimal | null;
  /** inspection */
  issueInspectionId: number | null;
  ticketIssues: IssueRef[];
  /** The line's own notes and files ([] when none). */
  notes: TicketNote[];
  attachments: TicketAttachment[];
}

export interface PaymentRevision {
  id: number;
  editedBy: string | IdName | null;
  createdAt: IsoDateTime;
}

/** One refund as the page of the payment it refunds lists it. */
export interface PaymentRefund {
  /** The refund itself is a payment (kind "refund"): open it with this id. */
  id: number;
  refundedAt: IsoDate;
  /** What came back, positive. */
  amount: Money;
  paymentMethod: { id: number; name: string } | null;
  reference: string | null;
  reason: string | null;
  mistaken: boolean;
  mistakenReason: string | null;
  lines: { id: number; refundOfLineId: number; amount: Money }[];
  createdBy?: IdName | string | null;
  createdAt: IsoDateTime;
}

export interface Payment {
  id: number;
  kind: PaymentKind;
  refundOf: RefundOf | null;
  refundReason: string | null;
  paidAt: IsoDate;
  paidTo: PaidTo;
  /** How we paid, from the editable list. */
  paymentMethod: { id: number; name: string } | null;
  reference: string | null;
  invoiceNumber: string | null;
  note: string | null;
  total: Money;
  refundedTotal: Money | null;
  netTotal: Money;
  mistaken: boolean;
  mistakenReason?: string | null;
  lines: PaymentLine[];
  /** The refunds of a payment, mistaken ones included; [] on a refund. */
  refunds: PaymentRefund[];
  notes: TicketNote[];
  attachments: TicketAttachment[];
  revisions: PaymentRevision[];
  createdAt: IsoDateTime;
  /** Sent back as expectedUpdatedAt on edit (409 when stale). */
  updatedAt: IsoDateTime;
}

/* ── Refund ──────────────────────────────────────────────────────────────── */

/** POST /payments/{id}/refunds: amounts are what came back, positive, at most each line's `refundable`. */
export interface RefundInput {
  refundedAt: IsoDate;
  paymentMethodId?: number | null;
  reference?: string | null;
  reason: string;
  lines: { lineId: number; amount: string }[];
}

/* ── Create / edit ───────────────────────────────────────────────────────── */

/** One line as sent. Each type uses its own subset (lib/maintenance-payments/line-types.ts). */
export interface PaymentLineInput {
  type: PaymentLineType;
  /** Exactly one of storeId / otherStore / storageLocationId. */
  storeId?: number | string | null;
  otherStore?: string | null;
  storageLocationId?: number | null;
  description?: string | null;
  amount?: string | number | null;
  hours?: string | number | null;
  rate?: string | number | null;
  tripSessionIds?: number[];
  ticketIssueIds?: number[];
  partId?: number | null;
  quantity?: string | number | null;
  unitCost?: string | number | null;
  boughtFromSupplierId?: number | null;
  destination?: PartsDestination | null;
  place?: PlaceAddressLine[];
  serials?: string[];
  technicianPurchaseIds?: number[];
  miles?: string | number | null;
  issueInspectionId?: number | null;
  /** New notes and files on this line (files go multipart: `lines[i][files][]`). */
  notes?: string[];
  files?: File[];
  /** Edit only: the saved notes / files of the replaced lines this line keeps. */
  keepNoteIds?: number[];
  keepAttachmentIds?: number[];
}

export interface PaymentInput {
  paidAt: IsoDate;
  /** Exactly one of technicianId / supplierId. */
  technicianId?: number | null;
  supplierId?: number | null;
  /** How we paid, from GET /payment-methods. Optional. */
  paymentMethodId?: number | null;
  /** Optional; the dialog no longer asks for these, an edit sends back what was saved. */
  reference?: string | null;
  invoiceNumber?: string | null;
  /** Older single note; prefer `notes`. */
  note?: string | null;
  /** New notes and files on the payment, as many as wanted. */
  notes?: string[];
  files?: File[];
  lines: PaymentLineInput[];
}

export interface EditPaymentInput extends PaymentInput {
  expectedUpdatedAt: IsoDateTime;
  /** The payment's own saved notes / files to take off. */
  removeNoteIds?: number[];
  removeAttachmentIds?: number[];
}

/* ── Unpaid work ─────────────────────────────────────────────────────────── */

export interface UnpaidWork {
  technician: IdName & { hourlyRate?: Money | null; category?: IdName | string | null };
  sessions: UnpaidSession[];
  purchases: TechnicianPurchase[];
  totals: { paidMinutes: number; purchasesTotal: Money };
}

/* ── Technician purchases ────────────────────────────────────────────────── */

export interface TechnicianPurchase {
  id: number;
  technician: IdName;
  tripId: number | null;
  ticketIssue: IssueRef | null;
  part: IdName | null;
  description: string;
  quantity: Decimal | null;
  totalCost: Money;
  supplier: IdName | null;
  serialNumber: string | null;
  boughtAt: IsoDateTime;
  /** Paid back by a payment line. */
  paid: boolean;
  paymentId: number | null;
  receipts: TicketAttachment[];
  mistaken: boolean;
}

export interface TechnicianPurchaseFilters {
  technicianId?: number;
  unpaid?: boolean;
}

export interface TechnicianPurchaseInput {
  technicianId: number;
  tripId?: number | null;
  description: string;
  partId?: number | null;
  quantity?: number | null;
  totalCost: string | number;
  supplierId?: number | null;
  supplierName?: string | null;
  ticketIssueId?: number | null;
  serialNumber?: string | null;
  receipt?: File[];
}

/* ── Inspection lookup (the Inspection line's picker) ────────────────────── */

/** GET issue-inspections: one row per inspection, newest first; mistaken ones never. */
export interface IssueInspectionLookupRow {
  id: number;
  ticketIssue: {
    id: number;
    ticketId: number;
    title: string;
    store: StoreRef | null;
    /** For a ticket at one of our storage locations. */
    storageLocation?: IdName | null;
    otherStore: string | null;
  } | null;
  technician: IdName | null;
  status: InspectionStatus;
  statusLabel: string;
  doneAt: IsoDateTime | null;
  scheduledDate: IsoDate | null;
  estimatedCost: Money | null;
  /** A line of a non-mistaken payment names this inspection. */
  paid: boolean;
}

export interface IssueInspectionLookupFilters {
  technicianId?: number;
  /** Only the ones no payment line pays yet. */
  unpaid?: boolean;
  /** The issue's title or the ticket id (a leading # allowed). */
  search?: string;
  /** Default 50, at most 100. */
  limit?: number;
}
