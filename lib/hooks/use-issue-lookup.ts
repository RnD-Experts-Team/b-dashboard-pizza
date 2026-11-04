"use client";

/**
 * The issue pickers' lookup (`GET ticket-issues`): light rows across every
 * store, newest first — the storage "Used on a ticket" search, the payment
 * line's Tickets, and the trip stops' issues. `null` filters = don't load.
 */

import { maintenanceWorkflowService } from "@/lib/api/services/maintenance-workflow.service";
import { keyOf, useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import type { TicketIssueLookupFilters } from "@/types/maintenance-system";

export function useIssueLookup(filters: TicketIssueLookupFilters | null) {
  const res = useMaintenanceResource(filters ? keyOf("ticket-issues", filters) : null, (signal) =>
    maintenanceWorkflowService.lookupIssues(filters ?? {}, signal),
  );
  return { ...res, issues: res.data ?? [] };
}
