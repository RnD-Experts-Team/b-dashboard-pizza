"use client";

import { Suspense } from "react";
import { PizzaLoader } from "@/components/shared/pizza-loader";
import { PaymentsPage } from "@/components/maintenance-payments/payments-page";

/**
 * Payments (docs/MAINTENANCE-UI.md §5): filters, KPI strip, list, Unpaid
 * work panel; primary Record a payment. Filters and `?payment=ID` are in the
 * URL, which needs the Suspense boundary.
 */
export default function MaintenancePaymentsPage() {
  return (
    <Suspense fallback={<PizzaLoader fullScreen={false} />}>
      <PaymentsPage />
    </Suspense>
  );
}
