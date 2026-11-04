"use client";

import { Suspense } from "react";
import { PizzaLoader } from "@/components/shared/pizza-loader";
import { OfficeOnly } from "@/components/maintenance-tickets/office-only";
import { PaymentsPage } from "@/components/maintenance-payments/payments-page";

/**
 * Payments (docs/MAINTENANCE-UI.md §5): filters, KPI strip, list, Unpaid
 * work panel; primary Record a payment. Filters and `?payment=ID` are in the
 * URL, which needs the Suspense boundary.
 */
export default function MaintenancePaymentsPage() {
  return (
    <Suspense fallback={<PizzaLoader fullScreen={false} />}>
      <OfficeOnly path="/payments">
        <PaymentsPage />
      </OfficeOnly>
    </Suspense>
  );
}
