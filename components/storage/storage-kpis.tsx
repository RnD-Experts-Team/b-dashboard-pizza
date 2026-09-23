"use client";

import { Boxes, Scale, TriangleAlert, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

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
  /**
   * How many (part, location) pairs are below zero -- ALL of them, counted by
   * the server. Never a count of what one page happened to contain.
   */
  negativeCount: number | null;
  isLoading?: boolean;
  onNegativesClick?: () => void;
}

export function StorageKpis({
  trackedPairs,
  locationCount,
  movementCount,
  negativeCount,
  isLoading,
  onNegativesClick,
}: StorageKpisProps) {
  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

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
          value={negativeCount == null ? "—" : String(negativeCount)}
          tone={negativeCount != null && negativeCount > 0 ? "alert" : "default"}
          onClick={negativeCount != null && negativeCount > 0 ? onNegativesClick : undefined}
          hint={negativeCount != null && negativeCount > 0 ? "needs reconciling" : undefined}
        />
      </div>
    </div>
  );
}
