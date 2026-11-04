"use client";

import { Suspense } from "react";
import { TicketPage, TicketPageSkeleton } from "@/components/maintenance-tickets/ticket/ticket-page";

/**
 * Ticket page (docs/MAINTENANCE-UI.md §2):
 * `/dashboard/maintenance-tickets/{id}?store=<store number>&issue=&tab=`.
 * `store` only scopes the auth rule; the ticket's own store comes back with it.
 */
export default function MaintenanceTicketPage() {
  return (
    <Suspense fallback={<TicketPageSkeleton />}>
      <TicketPage />
    </Suspense>
  );
}
