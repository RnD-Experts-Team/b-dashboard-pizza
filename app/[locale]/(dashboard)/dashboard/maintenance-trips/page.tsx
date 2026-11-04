"use client";

import { Suspense } from "react";
import { PizzaLoader } from "@/components/shared/pizza-loader";
import { OfficeOnly } from "@/components/maintenance-tickets/office-only";
import { TripsPage } from "@/components/maintenance-trips";

/**
 * Trips (docs/MAINTENANCE-UI.md §3): On the clock now · Today & upcoming ·
 * History; primary New trip; the trip drawer (?trip=ID).
 */
export default function MaintenanceTripsPage() {
  return (
    <Suspense fallback={<PizzaLoader fullScreen={false} />}>
      <OfficeOnly path="/trips">
        <TripsPage />
      </OfficeOnly>
    </Suspense>
  );
}
