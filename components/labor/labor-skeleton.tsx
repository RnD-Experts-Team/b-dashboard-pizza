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

export function LaborSkeleton() {
  return (
    <div className="space-y-3">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-[58px] rounded-lg" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionSkeleton height={300} />
        <SectionSkeleton height={300} />
      </div>

      <SectionSkeleton height={200} />
      <SectionSkeleton height={260} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionSkeleton height={220} />
        <SectionSkeleton height={220} />
      </div>

      <SectionSkeleton height={320} />
    </div>
  );
}
