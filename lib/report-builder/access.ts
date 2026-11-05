import type { CanAccessParams } from "@/lib/auth/can-access";
import type { CatalogDatasetRef, ReportCatalog } from "@/types/report-builder.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Report Builder access — what the pizzasys auth rules let the caller do.   */
/*                                                                            */
/*  Every check goes through canAccessRoute, never a permission name:         */
/*  - the builder's own routes are Data rules (`/report-builder/*`);          */
/*  - each dataset is ONE literal rule in its own service                    */
/*    (`POST /report-datasets/<key>/query`), probed with the store it would   */
/*    run for. A dataset the caller cannot query is hidden from the picker.   */
/* ────────────────────────────────────────────────────────────────────────── */

const REPORT_BUILDER_SERVICE = "Data";

export const RB_ROUTES = {
  templates: { service: REPORT_BUILDER_SERVICE, method: "GET", path: "/report-builder/templates" },
  createTemplate: { service: REPORT_BUILDER_SERVICE, method: "POST", path: "/report-builder/templates" },
  preview: { service: REPORT_BUILDER_SERVICE, method: "POST", path: "/report-builder/preview" },
  run: { service: REPORT_BUILDER_SERVICE, method: "POST", path: "/report-builder/run" },
  runs: { service: REPORT_BUILDER_SERVICE, method: "GET", path: "/report-builder/runs" },
  createSchedule: { service: REPORT_BUILDER_SERVICE, method: "POST", path: "/report-builder/schedules" },
} as const satisfies Record<string, CanAccessParams>;

type CanAccess = (params: CanAccessParams) => boolean;

/** Every dataset of the catalog, tagged with its service, in catalog order. */
export function flattenCatalog(catalog: ReportCatalog | null): CatalogDatasetRef[] {
  if (!catalog) return [];
  return catalog.services.flatMap((s) => (s.datasets ?? []).map((d) => ({ ...d, service: s.service })));
}

/** Services Data could not reach (no answer, an error status, another contract version). */
export function unavailableServices(catalog: ReportCatalog | null): string[] {
  return (catalog?.services ?? []).filter((s) => s.error).map((s) => s.service);
}

export function catalogIndex(datasets: CatalogDatasetRef[]): Map<string, CatalogDatasetRef> {
  return new Map(datasets.map((d) => [d.key, d]));
}

/** The auth-rule probe for querying one dataset at one store (none = the global check). */
function datasetAccess(dataset: CatalogDatasetRef, storeId?: string): CanAccessParams {
  return { service: dataset.service, method: "POST", path: dataset.path, storeId };
}

/** Datasets the caller may query at `storeId` — the only ones the picker offers. */
export function usableDatasets(datasets: CatalogDatasetRef[], can: CanAccess, storeId?: string): CatalogDatasetRef[] {
  return datasets.filter((d) => can(datasetAccess(d, storeId)));
}

/**
 * "All stores" sends no store list, which is the global (head-office) check
 * on every dataset — offer it only when every chosen dataset passes it.
 */
export function canUseAllStores(datasets: CatalogDatasetRef[], can: CanAccess): boolean {
  return datasets.length > 0 && datasets.every((d) => can(datasetAccess(d)));
}

export interface ScopeStore {
  /** Numeric store id — the storePermissions key canAccessRoute reads. */
  id: string;
  /** Store code sent on the wire ("03795-00044"). */
  code: string;
  name: string;
}

/** Stores where the caller may query EVERY chosen dataset. */
export function storesUsableFor(datasets: CatalogDatasetRef[], stores: ScopeStore[], can: CanAccess): ScopeStore[] {
  return stores.filter((s) => datasets.every((d) => can(datasetAccess(d, s.id))));
}
