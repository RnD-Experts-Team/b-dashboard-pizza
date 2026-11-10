"use client";

import type { ReactNode } from "react";
import { AlertCircle, Hourglass, Lock, PauseCircle, type LucideIcon } from "lucide-react";
import { WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { SPAN_CLASS, type V1Span } from "@/components/dashboard-v1/v1-card";
import { cn } from "@/lib/utils";
import type { SectionErrorKind, SectionState } from "@/types/business-reports.types";

const FULL_WIDTH: V1Span = 4;

/** A calm one-line note per reason — never a big red error block. */
const NOTE: Record<SectionErrorKind, { icon: LucideIcon; tone: string; title: string }> = {
  stopped: { icon: PauseCircle, tone: "border-border bg-muted/30 text-muted-foreground", title: "Stopped" },
  "too-big": {
    icon: Hourglass,
    tone: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    title: "Range too big",
  },
  "no-access": { icon: Lock, tone: "border-border bg-muted/30 text-muted-foreground", title: "No access" },
  failed: { icon: AlertCircle, tone: "border-border bg-muted/30 text-muted-foreground", title: "Not loaded" },
};

/** The one-line note a section shows in its place when it stopped or failed. */
export function SectionNote({ state, label }: { state: Pick<SectionState<unknown>, "error" | "errorKind">; label: string }) {
  const note = NOTE[state.errorKind ?? "failed"];
  const Icon = note.icon;
  return (
    <div
      role="status"
      className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px]", note.tone, SPAN_CLASS[FULL_WIDTH])}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="font-semibold">
        {label} · {note.title}
      </span>
      <span className="min-w-0 truncate text-muted-foreground" title={state.error ?? undefined}>
        {state.error}
      </span>
    </div>
  );
}

/**
 * Renders a section's cards once its data is in: skeleton cards (the same
 * spans the real cards take) while it loads, and a short note if it was
 * stopped or failed ("Range too big", "No access", …). Data that is already
 * there (e.g. a store-score batch) renders while the rest is still loading.
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
  /** What this slot shows, for the note ("Sales", "Labor report"…). */
  label: string;
  children: (data: T) => ReactNode;
}) {
  if (state.data) return <>{children(state.data)}</>;

  if (state.error) return <SectionNote state={state} label={label} />;

  return (
    <>
      {spans.map((span, i) => (
        <WbrCardSkeleton key={i} className={SPAN_CLASS[span]} />
      ))}
    </>
  );
}
