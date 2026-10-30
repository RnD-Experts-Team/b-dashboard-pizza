/* ────────────────────────────────────────────────────────────────────────── */
/*  Payments page filters ⇄ the query string (UX rule 9: deep links)         */
/*                                                                            */
/*  Keys are the API's own snake_case names, so a link built elsewhere —     */
/*  the technician report links `?technician_id=5&from=…&to=…` — opens the   */
/*  page already filtered. `payment=ID` opens the detail sheet and is kept   */
/*  apart from the filters (opening a payment must not reset the list).      */
/* ────────────────────────────────────────────────────────────────────────── */

import { LINE_TYPE_ORDER } from "@/lib/maintenance-payments/line-types";
import type { PaidToType, PaymentFilters, PaymentLineType } from "@/types/maintenance-v2";

export interface PaymentsPageFilters {
  from: string;
  to: string;
  paidTo: { type: PaidToType; id: number } | null;
  categoryId: number | null;
  /** Store number (the list filter matches store numbers, unlike line store_id). */
  store: string;
  type: PaymentLineType | null;
  search: string;
  showMistakes: boolean;
  page: number;
}

export const EMPTY_PAYMENTS_FILTERS: PaymentsPageFilters = {
  from: "",
  to: "",
  paidTo: null,
  categoryId: null,
  store: "",
  type: null,
  search: "",
  showMistakes: false,
  page: 1,
};

export const PAYMENT_PARAM = "payment";

/** `YYYY-MM-DD` only. https://regex101.com/?flavor=javascript&regex=%5E%5Cd%7B4%7D-%5Cd%7B2%7D-%5Cd%7B2%7D%24&testString=2026-10-30%0A2026-1-3 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function positiveInt(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function isLineType(raw: string | null): raw is PaymentLineType {
  return raw != null && (LINE_TYPE_ORDER as readonly string[]).includes(raw);
}

export function filtersFromParams(params: URLSearchParams): PaymentsPageFilters {
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const technicianId = positiveInt(params.get("technician_id"));
  const supplierId = positiveInt(params.get("supplier_id"));
  const type = params.get("type");
  const paidTo: PaymentsPageFilters["paidTo"] = technicianId ? { type: "technician", id: technicianId } : null;
  return {
    from: ISO_DATE.test(from) ? from : "",
    to: ISO_DATE.test(to) ? to : "",
    paidTo: paidTo ?? (supplierId ? { type: "supplier", id: supplierId } : null),
    categoryId: positiveInt(params.get("category_id")),
    store: params.get("store") ?? "",
    type: isLineType(type) ? type : null,
    search: params.get("search") ?? "",
    showMistakes: params.get("mistakes") === "1",
    page: positiveInt(params.get("page")) ?? 1,
  };
}

/** The filters written over `base` (other params, like `payment`, are kept). */
export function paramsFromFilters(filters: PaymentsPageFilters, base?: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base);
  ["from", "to", "technician_id", "supplier_id", "category_id", "store", "type", "search", "mistakes", "page"].forEach((k) =>
    p.delete(k),
  );
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  if (filters.paidTo) p.set(filters.paidTo.type === "technician" ? "technician_id" : "supplier_id", String(filters.paidTo.id));
  if (filters.categoryId) p.set("category_id", String(filters.categoryId));
  if (filters.store) p.set("store", filters.store);
  if (filters.type) p.set("type", filters.type);
  if (filters.search.trim()) p.set("search", filters.search.trim());
  if (filters.showMistakes) p.set("mistakes", "1");
  if (filters.page > 1) p.set("page", String(filters.page));
  return p;
}

/** What GET payments takes. */
export function toPaymentFilters(filters: PaymentsPageFilters, perPage: number): PaymentFilters {
  return {
    from: filters.from || undefined,
    to: filters.to || undefined,
    technicianId: filters.paidTo?.type === "technician" ? filters.paidTo.id : undefined,
    supplierId: filters.paidTo?.type === "supplier" ? filters.paidTo.id : undefined,
    categoryId: filters.categoryId ?? undefined,
    store: filters.store || undefined,
    type: filters.type ?? undefined,
    search: filters.search.trim() || undefined,
    includeMistaken: filters.showMistakes || undefined,
    page: filters.page,
    perPage,
  };
}

/** True when any filter (not the page) is set — shows "Clear all". */
export function hasActiveFilters(f: PaymentsPageFilters): boolean {
  return Boolean(f.from || f.to || f.paidTo || f.categoryId || f.store || f.type || f.search.trim() || f.showMistakes);
}

export function paymentIdFromParams(params: URLSearchParams): number | null {
  return positiveInt(params.get(PAYMENT_PARAM));
}
