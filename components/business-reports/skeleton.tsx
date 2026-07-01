"use client";

import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Loading placeholder shown while the (heavy) report request is in flight. */
export function BusinessReportsSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} className="h-24 p-4" />
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-40" />
        ))}
      </div>

      {/* Body */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border bg-card p-4">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 5 }).map((__, j) => (
              <Skeleton key={j} className="h-8 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
