"use client";

import { Boxes, Scale, TriangleAlert, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { StockBalance } from "@/types/storage.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Storage KPI strip                                                        */
/*                                                                            */
/*  THERE IS DELIBERATELY NO "TOTAL UNITS ON HAND" CELL. Summing on-hand      */
/*  across parts adds bolts to buckets of grease — the number means nothing.  */
/*  And summing a PAGE of anything is the exact mistake the ledger's mental   */
/*  model warns against.                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function StatCell({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "alert";
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-heading text-lg font-semibold leading-none tabular-nums sm:text-xl",
          tone === "alert" && "text-destructive"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{hint}</p>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 bg-card px-3 py-2 text-start transition-colors hover:bg-muted/50"
      >
        {body}
      </button>
    );
  }
  return <div className="min-w-0 bg-card px-3 py-2">{body}</div>;
}

interface StorageKpisProps {
  trackedPairs: number | null;
  locationCount: number | null;
  movementCount: number | null;
  /** Rows with a negative balance found in the scanned page. */
  negatives: StockBalance[] | null;
  /** How many pairs the scan actually looked at, and how many exist. */
  scanned?: number;
  scanTotal?: number;
  isLoading?: boolean;
  onNegativesClick?: () => void;
}

export function StorageKpis({
  trackedPairs,
  locationCount,
  movementCount,
  negatives,
  scanned,
  scanTotal,
  isLoading,
  onNegativesClick,
}: StorageKpisProps) {
  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  const negativeCount = negatives?.length ?? 0;
  // The API has no `negative` filter, so this count is page-bounded. Say so
  // rather than implying it is the whole picture.
  // TODO(backend): a `negative` filter on /stock-balances would make it exact.
  const partial = scanned != null && scanTotal != null && scanTotal > scanned;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="grid grid-cols-1 gap-px border-t bg-border min-[400px]:grid-cols-2 sm:grid-cols-4">
        <StatCell
          icon={Boxes}
          label="Tracked pairs"
          value={trackedPairs != null ? String(trackedPairs) : "—"}
          hint="part × location with history"
        />
        <StatCell
          icon={Warehouse}
          label="Locations"
          value={locationCount != null ? String(locationCount) : "—"}
        />
        <StatCell
          icon={Scale}
          label="Movements"
          value={movementCount != null ? String(movementCount) : "—"}
          hint="matching the current filters"
        />
        <StatCell
          icon={TriangleAlert}
          label="Negative balances"
          value={negatives == null ? "—" : String(negativeCount)}
          tone={negativeCount > 0 ? "alert" : "default"}
          onClick={negativeCount > 0 ? onNegativesClick : undefined}
          hint={
            negativeCount > 0
              ? partial
                ? `in the first ${scanned} of ${scanTotal} pairs — needs reconciling`
                : "needs reconciling"
              : partial
                ? `none in the first ${scanned} of ${scanTotal} pairs`
                : undefined
          }
        />
      </div>
    </div>
  );
}
