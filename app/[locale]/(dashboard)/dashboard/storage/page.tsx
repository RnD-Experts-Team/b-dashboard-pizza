"use client";

import { Suspense } from "react";
import { StorageView } from "@/components/storage/storage-view";
import { StorageSkeleton } from "@/components/storage/storage-shared";

/**
 * Storage (docs/MAINTENANCE-V2-UI.md §6): Stock · Movements · Stock counts ·
 * Locations (`?tab=`); primary Record stock. Suspense because the view reads
 * the URL with useSearchParams.
 */
export default function StoragePage() {
  return (
    <Suspense fallback={<StorageSkeleton />}>
      <StorageView />
    </Suspense>
  );
}
