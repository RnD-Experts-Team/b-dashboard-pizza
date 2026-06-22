"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import { Delta, pctChangeOrNull } from "./wbr-format";

/* ──────────────────────────────────────────────────────────────────────
 *  Generic period-comparison card shared by Customer & Sales and
 *  Phone & Adjusted Sales. Renders a YoY / Previous toggle and a dense
 *  table of granularity groups (Week / Period / Quarter / Year), each
 *  showing two metrics compared current-vs-baseline with a delta.
 * ────────────────────────────────────────────────────────────────────── */

export type CmpMode = "previous" | "yoy";

export interface CmpMetric {
  key: string;
  label: string;
  format: (n: number) => string;
}

export interface CmpGroup {
  label: string;
  /** Current values keyed by metric key. */
  current: Record<string, number>;
  /** Baseline values keyed by metric key (previous or last-year per mode). */
  baseline: Record<string, number>;
}

export function PeriodComparisonCard({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  gradient,
  headerNote,
  metrics,
  groupsForMode,
  className,
}: {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  gradient: string;
  headerNote?: string;
  metrics: CmpMetric[];
  groupsForMode: (mode: CmpMode) => CmpGroup[];
  className?: string;
}) {
  const [mode, setMode] = useState<CmpMode>("previous");
  const groups = groupsForMode(mode);
  const baselineLabel = mode === "yoy" ? "Last Yr" : "Prev";

  return (
    <Card
      className={cn(
        "flex h-[280px] flex-col gap-0 py-1.5 bg-linear-to-r",
        gradient,
        className,
      )}
    >
      <CardHeader className="shrink-0 px-3 pb-1">
        <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
          <div className={cn("rounded p-0.5", iconBg)}>
            <Icon className={cn("h-3 w-3", iconColor)} />
          </div>
          {title}
          {/* YoY / Previous toggle */}
          <div className="ml-1 inline-flex overflow-hidden rounded-md border border-border/60 bg-background/40 text-[9px] font-semibold">
            <button
              type="button"
              onClick={() => setMode("previous")}
              className={cn(
                "px-1.5 py-0.5 transition-colors",
                mode === "previous"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setMode("yoy")}
              className={cn(
                "px-1.5 py-0.5 transition-colors",
                mode === "yoy"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              YoY
            </button>
          </div>
          {headerNote && (
            <span className="ml-auto font-normal text-muted-foreground">
              {headerNote}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-0 pb-1">
        {/* Periods as rows, metrics as column headers */}
        <table className={cn(
          TBL,
          "text-[10px]",
          "[&_th]:!h-auto [&_th]:!px-2 [&_th]:!py-1.5 [&_th]:!bg-muted/50 [&_th]:!text-[10px]",
          "[&_td]:!px-2 [&_td]:!py-1.5",
        )}>
          <thead>
            <tr>
              <th className={cn(TH, "w-20 text-start")} />
              {metrics.map((m) => (
                <th key={m.key} className={cn(TH, NUM, "font-semibold text-foreground/80")}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.label}>
                <td className={cn(TD, "font-semibold text-foreground/70")}>
                  {g.label}
                </td>
                {metrics.map((m) => {
                  const curr = g.current[m.key] ?? 0;
                  const base = g.baseline[m.key] ?? 0;
                  return (
                    <td key={m.key} className={cn(TD, NUM)}>
                      <div className="font-semibold tabular-nums leading-tight">
                        {m.format(curr)}
                      </div>
                      <div className="flex items-center justify-end gap-1 leading-tight">
                        <span className="text-[9px] text-muted-foreground tabular-nums">
                          {baselineLabel} {m.format(base)}
                        </span>
                        <div className="[&>span]:!text-[9px] [&>span]:!px-1 [&>span]:!py-0 [&>span_svg]:!h-2 [&>span_svg]:!w-2">
                          <Delta value={pctChangeOrNull(curr, base)} />
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
