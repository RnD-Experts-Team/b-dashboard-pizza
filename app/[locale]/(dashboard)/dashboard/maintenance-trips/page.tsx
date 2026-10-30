"use client";

import { Suspense } from "react";
import { PizzaLoader } from "@/components/shared/pizza-loader";
import { TripsPage } from "@/components/maintenance-trips";

/**
 * Trips (docs/MAINTENANCE-V2-UI.md §3): On the clock now · Today & upcoming ·
 * History; primary New trip; the trip drawer (?trip=ID).
 */
export default function MaintenanceTripsPage() {
  return (
    <Suspense fallback={<PizzaLoader fullScreen={false} />}>
      <TripsPage />
    </Suspense>
  );
}
