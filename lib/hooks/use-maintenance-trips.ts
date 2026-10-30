"use client";

/**
 * Trips (office side): the list tabs (On the clock now · Today & upcoming ·
 * History), one trip for the drawer, and the unpaid sessions picker. Writes
 * that return the trip swap it into place via `useTrip().act`.
 */

import { maintenanceTripsService } from "@/lib/api/services/maintenance-trips.service";
import { keyOf, useMaintenanceMutation, useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import { TRIPPABLE_ISSUE_STATUSES } from "@/lib/maintenance-trips/view";
import type { Trip, TripFilters } from "@/types/maintenance-v2";

/** Tickets read per New trip dialog (the global list, open issues only). */
const PLANNER_PAGE_SIZE = 100;

export { maintenanceTripsService };

export function useTrips(filters: TripFilters = {}, enabled = true) {
  const res = useMaintenanceResource(enabled ? keyOf("trips", filters) : null, (signal) =>
    maintenanceTripsService.listTrips(filters, signal),
  );
  return { ...res, trips: res.data?.data ?? [], meta: res.data?.meta ?? null };
}

export function useTrip(tripId: number | null) {
  const res = useMaintenanceResource(tripId ? `trip:${tripId}` : null, (signal) =>
    maintenanceTripsService.getTrip(tripId as number, signal),
  );
  const mutation = useMaintenanceMutation(async (fn: (tripId: number) => Promise<Trip>) => {
    if (!tripId) throw new Error("No trip selected.");
    const next = await fn(tripId);
    res.setData(next);
    return next;
  });
  return {
    ...res,
    trip: res.data,
    /** Runs one correction/action and shows the trip it returns. */
    act: mutation.run,
    pending: mutation.isPending,
    actionError: mutation.error,
  };
}

/** Closed sessions nobody has paid yet (the hourly payment line's checklist). */
export function useUnpaidSessions(technicianId: number | null) {
  const res = useMaintenanceResource(technicianId ? `unpaid-sessions:${technicianId}` : null, (signal) =>
    maintenanceTripsService.listUnpaidSessions(technicianId as number, signal),
  );
  return { ...res, sessions: res.data ?? [] };
}

/** Tickets with issues a technician can still be sent for (the New trip dialog's stops). */
export function usePlannerTickets(search: string, enabled = true) {
  const res = useMaintenanceResource(enabled ? keyOf("trip-planner-tickets", { search }) : null, (signal) =>
    maintenanceTripsService.listPlannerTickets(
      { issueStatuses: TRIPPABLE_ISSUE_STATUSES, search: search || undefined, perPage: PLANNER_PAGE_SIZE },
      signal,
    ),
  );
  return { ...res, tickets: res.data?.data ?? [] };
}
