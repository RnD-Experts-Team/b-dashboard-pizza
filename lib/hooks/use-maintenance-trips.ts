"use client";

/**
 * Trips (office side): the list tabs (On the clock now · Today & upcoming ·
 * History), one trip for the drawer, and the unpaid sessions picker. Writes
 * that return the trip swap it into place via `useTrip().act`.
 */

import { maintenanceTripsService } from "@/lib/api/services/maintenance-trips.service";
import { keyOf, useMaintenanceMutation, useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import type { Trip, TripFilters } from "@/types/maintenance-system";

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
