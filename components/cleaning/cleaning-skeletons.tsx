import { Skeleton } from "@/components/ui/skeleton";

/* ── Due Today: task table (the filter toolbar is always shown for real) ── */
export function DueSkeleton() {
  return (
    <div className="divide-y rounded-lg border">
      <div className="flex items-center gap-4 px-4 py-3">
        {["w-40", "w-16", "w-20", "w-28", "w-12", "w-20"].map((w, i) => (
          <Skeleton key={i} className={`h-3 ${w}`} />
        ))}
        <Skeleton className="ms-auto h-3 w-16" />
      </div>
      {Array.from({ length: 6 }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ms-auto h-8 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/* ── Tasks: table rows (the refresh/create bar is always shown for real) ── */
export function TasksSkeleton() {
  return (
    <div className="divide-y rounded-lg border">
      <div className="flex items-center gap-4 px-4 py-3">
        {["w-40", "w-20", "w-14", "w-16", "w-20", "w-12"].map((w, i) => (
          <Skeleton key={i} className={`h-3 ${w}`} />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </div>
  );
}

/* ── Evaluation: flat toolbar + grid (matches Due/Tasks styling) ── */
export function EvaluationSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Actions row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-9 w-40 rounded-md" />
          <Skeleton className="h-9 w-16 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>

      {/* Legend row */}
      <div className="flex items-center gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-3 bg-muted/40 px-4 py-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        {Array.from({ length: 6 }).map((_, r) => (
          <div
            key={r}
            className="flex items-center gap-3 border-t border-border/60 px-4 py-3"
          >
            <Skeleton className="h-8 w-28" />
            <div className="flex flex-1 gap-2">
              <Skeleton className="h-8 flex-1 rounded-md" />
              <Skeleton className="h-8 flex-1 rounded-md" />
              <Skeleton className="h-8 flex-1 rounded-md" />
            </div>
            <Skeleton className="h-7 w-14 rounded-md" />
            <div className="flex flex-1 gap-2">
              <Skeleton className="h-8 flex-1 rounded-md" />
              <Skeleton className="h-8 flex-1 rounded-md" />
            </div>
            <Skeleton className="h-7 w-14 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Reports: flat header + single consolidated ranked table ── */
export function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border">
        {/* column header */}
        <div className="flex items-center gap-3 bg-muted/40 px-3 py-2.5">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-24" />
        </div>
        {/* rows */}
        {Array.from({ length: 8 }).map((_, r) => (
          <div
            key={r}
            className="flex items-center gap-3 border-t border-border/60 px-3 py-2.5"
          >
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-2 w-20 rounded-full" />
              <Skeleton className="h-4 w-9" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
