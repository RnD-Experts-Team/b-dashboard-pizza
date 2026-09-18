"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { CATEGORIES, type CategoryKey } from "./category";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1Section — a labeled, color-coded band of cards.
 *
 *  Renders a small category header (icon + label in the category color) above
 *  a compact 4-column grid. Cards set their own span (1/2/3) via V1Card.
 *  Clicking the header collapses/expands the whole grid (Radix Collapsible,
 *  same pattern as attendance-panel.tsx) — every section starts expanded.
 *  The height animation comes from tw-animate-css's collapsible-down/up
 *  utilities, which read Radix's own --radix-collapsible-content-height var.
 * ────────────────────────────────────────────────────────────────────────── */

export function V1Section({
  category,
  weekLabel,
  children,
  className,
  gridClassName,
  guideId,
}: {
  category: CategoryKey;
  weekLabel?: string;
  children: ReactNode;
  className?: string;
  gridClassName?: string;
  /** Marks this section as a PageGuide target (see dashboard-v1-guide-config). */
  guideId?: string;
}) {
  const cat = CATEGORIES[category];
  const Icon = cat.icon;
  const [open, setOpen] = useState(true);

  return (
    <section
      data-guide-id={guideId}
      className={cn("space-y-1 border-l-2 pl-3 rounded-md", cat.border, className)}
    >
      <Collapsible open={open} onOpenChange={setOpen} className="space-y-1">
        <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-0.5 text-left transition-opacity hover:opacity-80">
          <div className={cn("rounded p-0.5", cat.iconBg)}>
            <Icon className={cn("h-3.5 w-3.5", cat.text)} />
          </div>
          <h2
            className={cn(
              "text-[12px] font-bold uppercase tracking-wide",
              cat.headerText,
            )}
          >
            {cat.label}
          </h2>
          {weekLabel && (
            <span className="text-[11px] font-normal text-muted-foreground">
              {weekLabel}
            </span>
          )}
          <div className="ms-1 h-px flex-1 bg-linear-to-r from-border to-transparent" />
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", cat.text, open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          {/* Dense flow backfills any gap so a short last row never leaves a hole. */}
          <div className={cn("grid [grid-auto-flow:dense] grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-4", gridClassName)}>
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
