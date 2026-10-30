/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance v2 — payments, unpaid work, technician purchases (§4)        */
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

/** `App\Enums\PaymentLineType`. */
export type PaymentLineType = "hourly" | "fixed" | "inspection" | "parts" | "gas" | "other";

/** `App\Enums\PaymentMethod`. null = not recorded (migrated rows). */
export type PaymentMethod = "cash" | "check" | "card" | "bank_transfer" | "zelle" | "other";

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

export interface PaymentListRow {
  id: number;
  paidAt: IsoDate;
  paidTo: PaidTo;
  method: PaymentMethod | null;
  reference: string | null;
  invoiceNumber: string | null;
  total: Money;
  lineCount: number;
  /** Store numbers. */
  stores: string[];
  types: PaymentLineType[];
  hasInvoice: boolean;
  mistaken: boolean;
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
  page?: number;
  perPage?: number;
}

/* ── One payment ─────────────────────────────────────────────────────────── */

export interface PlaceAddressLine {
  levelId: number;
  valueId: number;
}

export interface PaymentLine {
  id: number;
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
  place?: PlaceAddressLine[];
  stockMovementId: number | null;
  serials: string[];
  technicianPurchases: TechnicianPurchase[];
  /** gas */
  miles: Decimal | null;
  /** inspection */
  issueInspectionId: number | null;
  ticketIssues: IssueRef[];
}

export interface PaymentRevision {
  id: number;
  editedBy: string | IdName | null;
  createdAt: IsoDateTime;
}

export interface Payment {
  id: number;
  paidAt: IsoDate;
  paidTo: PaidTo;
  method: PaymentMethod | null;
  reference: string | null;
  invoiceNumber: string | null;
  note: string | null;
  total: Money;
  mistaken: boolean;
  mistakenReason?: string | null;
  lines: PaymentLine[];
  notes: TicketNote[];
  attachments: TicketAttachment[];
  revisions: PaymentRevision[];
  createdAt: IsoDateTime;
  /** Sent back as expectedUpdatedAt on edit (409 when stale). */
  updatedAt: IsoDateTime;
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
}

export interface PaymentInput {
  paidAt: IsoDate;
  /** Exactly one of technicianId / supplierId. */
  technicianId?: number | null;
  supplierId?: number | null;
  method?: PaymentMethod | null;
  reference?: string | null;
  invoiceNumber?: string | null;
  note?: string | null;
  files?: File[];
  lines: PaymentLineInput[];
}

export interface EditPaymentInput extends PaymentInput {
  expectedUpdatedAt: IsoDateTime;
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
