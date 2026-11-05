"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { SPAN_CLASS, type V1Span } from "@/components/dashboard-v1/v1-card";
import { cn } from "@/lib/utils";
import type { SectionState } from "@/types/business-reports.types";

const FULL_WIDTH: V1Span = 4;

/**
 * Renders a section's cards once its data is in: skeleton cards (the same
 * spans the real cards take) while it loads, one error card if it failed.
 * Data that is already there (e.g. a store-score batch) renders while the
 * rest is still loading.
 */
export function SectionSlot<T>({
  state,
  spans,
  label,
  children,
}: {
  state: SectionState<T>;
  /** The spans of the cards this slot renders, for matching skeletons. */
  spans: V1Span[];
  /** What failed, for the error card ("Sales", "Labor report"…). */
  label: string;
  children: (data: T) => ReactNode;
}) {
  if (state.data) return <>{children(state.data)}</>;

  if (state.error) {
    return (
      <Card
        className={cn(
          "flex h-[120px] flex-col items-center justify-center gap-1.5 border-destructive/30 bg-destructive/5 px-4 text-center",
          SPAN_CLASS[FULL_WIDTH],
        )}
      >
        <AlertCircle className="h-5 w-5 text-destructive" />
        <p className="text-[11px] font-semibold">{label} could not be loaded</p>
        <p className="max-w-xl text-[11px] text-muted-foreground">{state.error}</p>
      </Card>
    );
  }

  return (
    <>
      {spans.map((span, i) => (
        <WbrCardSkeleton key={i} className={SPAN_CLASS[span]} />
      ))}
    </>
  );
}
