"use client";

import { Suspense } from "react";
import { StorageView } from "@/components/storage/storage-view";
import { OfficeOnly } from "@/components/maintenance-tickets/office-only";
import { StorageSkeleton } from "@/components/storage/storage-shared";

/**
 * Storage (docs/MAINTENANCE-UI.md §6): Stock · Movements · Stock counts ·
 * Locations (`?tab=`); primary Record stock. Suspense because the view reads
 * the URL with useSearchParams.
 */
export default function StoragePage() {
  return (
    <Suspense fallback={<StorageSkeleton />}>
      <OfficeOnly path="/stock-balances">
        <StorageView />
      </OfficeOnly>
    </Suspense>
  );
}
