"use client";

import type { ReactNode } from "react";
import { CATEGORIES, type CategoryKey } from "./category";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1Section — a labeled, color-coded band of cards.
 *
 *  Renders a small category header (icon + label in the category color) above
 *  a compact 4-column grid. Cards set their own span (1/2/3) via V1Card.
 * ────────────────────────────────────────────────────────────────────────── */

export function V1Section({
  category,
  children,
  className,
}: {
  category: CategoryKey;
  children: ReactNode;
  className?: string;
}) {
  const cat = CATEGORIES[category];
  const Icon = cat.icon;

  return (
    <section className={cn("space-y-1 border-l-2 pl-3 rounded-md", cat.border, className)}>
      <div className="flex items-center gap-1.5 px-0.5">
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
        <div className="ms-1 h-px flex-1 bg-linear-to-r from-border to-transparent" />
      </div>
      {/* Dense flow backfills any gap so a short last row never leaves a hole. */}
      <div className="grid [grid-auto-flow:dense] grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
    </section>
  );
}
