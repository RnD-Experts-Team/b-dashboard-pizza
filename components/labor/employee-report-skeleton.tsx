"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function SectionSkeleton({ height = 180 }: { height?: number }) {
  return (
    <Card className="gap-0 py-3">
      <CardHeader className="px-3 pb-2">
        <Skeleton className="h-3.5 w-32" />
      </CardHeader>
      <CardContent className="px-3">
        <Skeleton className="w-full" style={{ height }} />
      </CardContent>
    </Card>
  );
}

/** Shown while the Employee Report's own fetch is loading — independent of the labor report's loading state. */
export function EmployeeReportSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[58px] rounded-lg" />
        ))}
      </div>

      <SectionSkeleton height={120} />
      <SectionSkeleton height={200} />
      <SectionSkeleton height={220} />
      <SectionSkeleton height={220} />
    </div>
  );
}
