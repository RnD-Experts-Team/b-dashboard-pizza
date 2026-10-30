/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance v2 — payments, unpaid work, technician purchases (§4)        */
/*                                                                            */
/*  A payment is paid to ONE technician or ONE supplier and is a list of     */
/*  lines (hourly · fixed · inspection · parts · gas · other). The server     */
/*  computes every amount; lib/maintenance-payments previews them.           */
/*  Editing replaces the lines (409 when someone saved in between — send     */
/*  the `updatedAt` you loaded as expectedUpdatedAt). "Mark as mistake"      */
/*  keeps the lines for history and undoes their stock and claims.           */
/*                                                                            */
/*  With an invoice file the body goes multipart with bracket notation       */
/*  (`lines[0][type]`), which the contract allows.                           */
/*                                                                            */
/*  Internal routes: payments/[[...path]], unpaid-work,                      */
/*  technician-purchases/[[...path]], issue-inspections.                     */
/* ────────────────────────────────────────────────────────────────────────── */

import { http, seg } from "@/lib/api/maintenance-v2/http";
import type {
  EditPaymentInput,
  IssueInspectionLookupFilters,
  IssueInspectionLookupRow,
  Payment,
  PaymentFilters,
  PaymentInput,
  PaymentList,
  PaymentListMeta,
  PaymentListRow,
  ReasonPayload,
  TechnicianPurchase,
  TechnicianPurchaseFilters,
  TechnicianPurchaseInput,
  UnpaidWork,
} from "@/types/maintenance-v2";
import type { TicketAttachment, TicketNote } from "@/types/maintenance-tickets.types";

const paymentPath = (id: number) => `/payments/${seg(id)}`;

export const maintenancePaymentsService = {
  /** `meta.totals` carries the count and total of the whole filtered list. */
  listPayments(filters: PaymentFilters = {}, signal?: AbortSignal): Promise<PaymentList> {
    return http.page<PaymentListRow, PaymentListMeta>("/payments", { query: filters, signal });
  },
  /** Lines with their links, notes, files and revisions. */
  getPayment(id: number, signal?: AbortSignal): Promise<Payment> {
    return http.get<Payment>(paymentPath(id), { signal });
  },
  createPayment(input: PaymentInput): Promise<Payment> {
    return http.post<Payment>("/payments", input);
  },
  /** 409 (CONFLICT) when `expectedUpdatedAt` is stale. */
  editPayment(id: number, input: EditPaymentInput): Promise<Payment> {
    return http.post<Payment>(`${paymentPath(id)}/edit`, input);
  },
  markPaymentMistaken(id: number, payload: ReasonPayload): Promise<Payment> {
    return http.post<Payment>(`${paymentPath(id)}/mistaken`, payload);
  },
  addPaymentNote(id: number, note: { body: string; files?: File[] }): Promise<TicketNote> {
    return http.post<TicketNote>(`${paymentPath(id)}/notes`, note);
  },
  addPaymentAttachments(id: number, files: File[]): Promise<TicketAttachment[]> {
    return http.post<TicketAttachment[]>(`${paymentPath(id)}/attachments`, { files });
  },

  /* ── Unpaid work (the side panel, "Pay this") ────────────────────────── */

  /** Per technician: clocked time not paid + purchases not paid back. */
  listUnpaidWork(technicianId?: number, signal?: AbortSignal): Promise<UnpaidWork[]> {
    return http.rows<UnpaidWork>("/unpaid-work", { query: { technicianId }, signal });
  },

  /* ── Technician purchases ───────────────────────────────────────────── */

  listTechnicianPurchases(filters: TechnicianPurchaseFilters = {}, signal?: AbortSignal): Promise<TechnicianPurchase[]> {
    return http.rows<TechnicianPurchase>("/technician-purchases", { query: filters, signal });
  },
  createTechnicianPurchase(input: TechnicianPurchaseInput): Promise<TechnicianPurchase> {
    return http.post<TechnicianPurchase>("/technician-purchases", input);
  },
  markTechnicianPurchaseMistaken(id: number, payload?: Partial<ReasonPayload>): Promise<TechnicianPurchase> {
    return http.post<TechnicianPurchase>(`/technician-purchases/${seg(id)}/mistaken`, payload);
  },

  /* ── Inspection lookup (the Inspection line's picker) ────────────────── */

  /** Inspections across every store, newest first, each saying whether a payment already pays it. */
  lookupInspections(filters: IssueInspectionLookupFilters = {}, signal?: AbortSignal): Promise<IssueInspectionLookupRow[]> {
    return http.rows<IssueInspectionLookupRow>("/issue-inspections", { query: filters, signal });
  },
};
