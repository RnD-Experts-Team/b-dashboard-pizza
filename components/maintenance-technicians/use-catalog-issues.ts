"use client";

import { useMemo } from "react";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";
import { useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import type { CatalogIssue } from "@/types/maintenance-tickets.types";

/** The catalog issues (what can break) that are not deleted, A → Z — for the "issue covered" pickers. */
export function useCatalogIssues(enabled = true) {
  const res = useMaintenanceResource<CatalogIssue[]>(enabled ? "catalog-issues:active" : null, (signal) =>
    maintenanceTicketsService.getCatalogIssues(signal),
  );
  const issues = useMemo(
    () => (res.data ?? []).filter((i) => !i.deletedAt).sort((a, b) => a.title.localeCompare(b.title)),
    [res.data],
  );
  return { ...res, issues };
}
