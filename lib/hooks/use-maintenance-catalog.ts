"use client";

/**
 * Catalog reads for v2 screens: technicians (ranked when a store/issue is
 * given — the technician picker), one technician, categories, suppliers,
 * parts, a part's serial units, and who covers which issue. Writes go
 * through `useMaintenanceMutation(maintenanceCatalogService.x)`.
 */

import { maintenanceCatalogService } from "@/lib/api/services/maintenance-catalog.service";
import { keyOf, useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import type { PartSerialStatus, SupplierFilters, TechnicianFilters } from "@/types/maintenance-v2";

export { maintenanceCatalogService };

export function useTechnicians(filters: TechnicianFilters = {}, enabled = true) {
  const res = useMaintenanceResource(enabled ? keyOf("technicians", filters) : null, (signal) =>
    maintenanceCatalogService.listTechnicians(filters, signal),
  );
  return { ...res, technicians: res.data?.data ?? [], meta: res.data?.meta ?? null };
}

export function useTechnician(id: number | null) {
  const res = useMaintenanceResource(id ? `technician:${id}` : null, (signal) =>
    maintenanceCatalogService.getTechnician(id as number, signal),
  );
  return { ...res, technician: res.data };
}

export function useTechnicianCategories(enabled = true) {
  const res = useMaintenanceResource(enabled ? "technician-categories" : null, (signal) =>
    maintenanceCatalogService.listCategories(signal),
  );
  return { ...res, categories: res.data ?? [] };
}

export function useTechnicianAbilities(enabled = true) {
  const res = useMaintenanceResource(enabled ? "technician-abilities" : null, (signal) =>
    maintenanceCatalogService.listAbilities(signal),
  );
  return { ...res, abilities: res.data ?? [] };
}

export function useSuppliers(filters: SupplierFilters = {}, enabled = true) {
  const res = useMaintenanceResource(enabled ? keyOf("suppliers", filters) : null, (signal) =>
    maintenanceCatalogService.listSuppliers(filters, signal),
  );
  return { ...res, suppliers: res.data?.data ?? [], meta: res.data?.meta ?? null };
}

export function useSupplier(id: number | null) {
  const res = useMaintenanceResource(id ? `supplier:${id}` : null, (signal) =>
    maintenanceCatalogService.getSupplier(id as number, signal),
  );
  return { ...res, supplier: res.data };
}

export function useParts(opts: { search?: string; includeDeleted?: boolean } = {}, enabled = true) {
  const res = useMaintenanceResource(enabled ? keyOf("parts", opts) : null, (signal) =>
    maintenanceCatalogService.listParts(opts, signal),
  );
  return { ...res, parts: res.data ?? [] };
}

/** One part, deleted ones too (with `unitsCount`). */
export function usePart(id: number | null, enabled = true) {
  const res = useMaintenanceResource(enabled && id ? `part:${id}` : null, (signal) =>
    maintenanceCatalogService.getPart(id as number, signal),
  );
  return { ...res, part: res.data };
}

export function usePartUnits(partId: number | null, status?: PartSerialStatus) {
  const res = useMaintenanceResource(partId ? keyOf(`part-units:${partId}`, { status }) : null, (signal) =>
    maintenanceCatalogService.listPartUnits(partId as number, status, signal),
  );
  return { ...res, units: res.data ?? [] };
}
