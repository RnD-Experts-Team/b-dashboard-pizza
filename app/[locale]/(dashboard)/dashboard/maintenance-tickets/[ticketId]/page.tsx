"use client";

import { Suspense } from "react";
import { TicketPage } from "@/components/maintenance-tickets/ticket/ticket-page";
import { TicketsSkeleton } from "@/components/maintenance-tickets/tickets-skeleton";

/**
 * Ticket page (docs/MAINTENANCE-UI.md §2):
 * `/dashboard/maintenance-tickets/{id}?store=<store number>&issue=&tab=`.
 * `store` only scopes the auth rule; the ticket's own store comes back with it.
 */
export default function MaintenanceTicketPage() {
  return (
    <Suspense fallback={<TicketsSkeleton />}>
      <TicketPage />
    </Suspense>
  );
}
