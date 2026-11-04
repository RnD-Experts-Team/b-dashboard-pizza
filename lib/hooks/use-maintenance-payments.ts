"use client";

/**
 * Payments: the filtered list (with its count/total for the KPI strip), one
 * payment for the detail sheet, the Unpaid work side panel, and technician
 * purchases. Saving goes through `useMaintenanceMutation(...)` with the body
 * built by lib/maintenance-payments (draftToInput / draftToEditInput).
 */

import { maintenancePaymentsService } from "@/lib/api/services/maintenance-payments.service";
import { keyOf, useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import type { IssueInspectionLookupFilters, PaymentFilters, TechnicianPurchaseFilters } from "@/types/maintenance-system";

export { maintenancePaymentsService };

export function usePayments(filters: PaymentFilters = {}, enabled = true) {
  const res = useMaintenanceResource(enabled ? keyOf("payments", filters) : null, (signal) =>
    maintenancePaymentsService.listPayments(filters, signal),
  );
  return {
    ...res,
    payments: res.data?.data ?? [],
    meta: res.data?.meta ?? null,
    totals: res.data?.meta?.totals ?? null,
  };
}

export function usePayment(id: number | null) {
  const res = useMaintenanceResource(id ? `payment:${id}` : null, (signal) =>
    maintenancePaymentsService.getPayment(id as number, signal),
  );
  return { ...res, payment: res.data };
}

export function useUnpaidWork(technicianId?: number | null, enabled = true) {
  const res = useMaintenanceResource(enabled ? keyOf("unpaid-work", { technicianId }) : null, (signal) =>
    maintenancePaymentsService.listUnpaidWork(technicianId ?? undefined, signal),
  );
  return { ...res, unpaidWork: res.data ?? [] };
}

export function useTechnicianPurchases(filters: TechnicianPurchaseFilters = {}, enabled = true) {
  const res = useMaintenanceResource(enabled ? keyOf("technician-purchases", filters) : null, (signal) =>
    maintenancePaymentsService.listTechnicianPurchases(filters, signal),
  );
  return { ...res, purchases: res.data ?? [] };
}

/** Inspections to pay for (the Inspection line's picker), newest first. */
export function useInspectionLookup(filters: IssueInspectionLookupFilters, enabled = true) {
  const res = useMaintenanceResource(enabled ? keyOf("issue-inspections", filters) : null, (signal) =>
    maintenancePaymentsService.lookupInspections(filters, signal),
  );
  return { ...res, inspections: res.data ?? [] };
}
