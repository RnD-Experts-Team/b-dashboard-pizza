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

      <CardContent className="min-h-0 flex-1 overflow-y-auto px-0 pb-1">
        <table className={cn(TBL, "[&_th]:!bg-muted")}>
          <thead>
            <tr>
              <th className={TH}>Metric</th>
              <th className={cn(TH, NUM)}>Current</th>
              <th className={cn(TH, NUM)}>{baselineLabel}</th>
              <th className={cn(TH, NUM)}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupRows key={g.label} group={g} metrics={metrics} />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function GroupRows({
  group,
  metrics,
}: {
  group: CmpGroup;
  metrics: CmpMetric[];
}) {
  return (
    <>
      <tr className="border-b-0">
        <td
          colSpan={4}
          className="bg-muted/30 px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {group.label}
        </td>
      </tr>
      {metrics.map((m) => {
        const curr = group.current[m.key] ?? 0;
        const base = group.baseline[m.key] ?? 0;
        return (
          <tr key={m.key}>
            <td className={cn(TD, "pl-3 text-muted-foreground")}>{m.label}</td>
            <td className={cn(TD, NUM, "font-medium")}>{m.format(curr)}</td>
            <td className={cn(TD, NUM, "text-muted-foreground")}>
              {m.format(base)}
            </td>
            <td className={cn(TD, NUM)}>
              <Delta value={pctChangeOrNull(curr, base)} />
            </td>
          </tr>
        );
      })}
    </>
  );
}
