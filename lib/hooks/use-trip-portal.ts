"use client";

/**
 * The technician's trip page (`/[locale]/trip/[token]`, no login).
 *
 *   const portal = useTripPortal(token);
 *   portal.trip / portal.errorKind ("expired" → full-page message) / portal.buttons
 *   await portal.act((t) => tripPortalService.clockIn(t, { usingCar: true }));
 *
 * Every action returns the refreshed trip, which replaces the one shown.
 * A failed action keeps the trip on screen and reports `actionErrorKind`
 * ("network" → "No connection — Retry").
 */

import { useMemo } from "react";
import { portalErrorKind, tripPortalService } from "@/lib/api/services/trip-portal.service";
import { useMaintenanceMutation, useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import { buttonsForState } from "@/lib/maintenance-trips";
import type { PublicTrip } from "@/types/maintenance-v2";

export { tripPortalService };

export function useTripPortal(token: string | null) {
  const res = useMaintenanceResource(token ? `trip-portal:${token}` : null, (signal) =>
    tripPortalService.getTrip(token as string, signal),
  );

  const mutation = useMaintenanceMutation(async (fn: (token: string) => Promise<PublicTrip>) => {
    if (!token) throw new Error("No trip link.");
    const next = await fn(token);
    res.setData(next);
    return next;
  });

  const trip = res.data;
  const buttons = useMemo(() => (trip ? buttonsForState(trip.state) : null), [trip]);

  return {
    ...res,
    trip,
    /** Why the page could not load (expired / not_found / network / …). */
    errorKind: res.error ? portalErrorKind(res.error) : null,
    buttons,
    act: mutation.run,
    pending: mutation.isPending,
    actionError: mutation.error,
    actionErrorKind: mutation.error ? portalErrorKind(mutation.error) : null,
    resetActionError: mutation.reset,
  };
}
