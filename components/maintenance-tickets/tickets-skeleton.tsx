"use client";

import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 6;
const CARDS = 4;
/** Ticket #, title, store, status, priority, assigned, target, updated — as in the list. */
const COLUMNS = [
  { w: "w-12" },
  { w: "w-48" },
  { w: "w-14" },
  { w: "w-24", pill: true },
  { w: "w-16", pill: true },
  { w: "w-24" },
  { w: "w-20" },
  { w: "w-20" },
];

/**
 * The tickets list while it loads: the table's shape on desktop, the cards'
 * on a phone. The page header and filters above it are already real, so
 * this draws only the list.
 */
export function TicketsSkeleton() {
  return (
    <div aria-busy="true" className="space-y-3">
      <Skeleton className="h-4 w-40" />

      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div className="flex gap-6 border-b bg-muted/30 px-4 py-3">
          {COLUMNS.map((c, i) => (
            <Skeleton key={i} className={`h-3 ${c.w}`} />
          ))}
        </div>
        {Array.from({ length: ROWS }).map((_, row) => (
          <div key={row} className="flex items-center gap-6 border-b px-4 py-3.5 last:border-0">
            {COLUMNS.map((c, col) => (
              <Skeleton key={col} className={c.pill ? `h-5 ${c.w} rounded-full` : `h-4 ${c.w}`} />
            ))}
          </div>
        ))}
      </div>

      <div className="space-y-2 md:hidden">
        {Array.from({ length: CARDS }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-44" />
              </div>
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
