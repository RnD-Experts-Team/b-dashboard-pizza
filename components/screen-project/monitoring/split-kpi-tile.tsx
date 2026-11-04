"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { scrollToSection } from "@/lib/maintenance-tickets/scroll-to-section";

export interface SplitKpiHalf {
  caption: string;
  /** Already formatted ("72%"). */
  value: string;
  note: string;
}

export interface SplitKpi {
  label: string;
  icon: LucideIcon;
  tint: string;
  /** The first half is the headline (of open hours), the second the other basis (of connected). */
  halves: [SplitKpiHalf, SplitKpiHalf];
  target?: string;
}

/** A headline tile cut in two: one number over two bases, side by side, same shell as `KpiTile`. */
export function SplitKpiTile({ kpi }: { kpi: SplitKpi }) {
  const Icon = kpi.icon;
  const shell = "block w-full rounded-xl border bg-card p-4 text-start shadow-sm";
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-muted-foreground">{kpi.label}</p>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", kpi.tint)}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 divide-x rtl:divide-x-reverse">
        {kpi.halves.map((h, i) => (
          <div key={h.caption} className={cn("min-w-0", i === 0 ? "pe-3" : "ps-3")}>
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{h.caption}</p>
            <p className={cn("mt-1 font-heading text-2xl font-semibold leading-none tabular-nums", i > 0 && "text-muted-foreground")}>
              {h.value}
            </p>
            <p className="mt-2 truncate text-xs text-muted-foreground" title={h.note}>{h.note}</p>
          </div>
        ))}
      </div>
    </>
  );
  return kpi.target ? (
    <button
      type="button"
      onClick={() => scrollToSection(kpi.target!)}
      className={cn(shell, "cursor-pointer transition-colors duration-150 hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      aria-label={`${kpi.label}: ${kpi.halves.map((h) => `${h.value} ${h.caption}`).join(", ")}`}
    >
      {body}
    </button>
  ) : (
    <div className={shell}>{body}</div>
  );
}
