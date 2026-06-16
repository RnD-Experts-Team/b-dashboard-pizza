"use client";

import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import type { OrdersVsSales } from "@/types/dashboard-report.types";
import { fmt$, fmtPct, StatTile } from "./wbr-format";

export function WbrOrdersVsSalesCard({
  data,
  className,
}: {
  data?: OrdersVsSales;
  className?: string;
}) {
  if (!data) return null;

  const { filtering, current_week, four_weeks, twelve_weeks, six_months } = data;

  const rows = [
    { label: "Current Wk", period: current_week },
    { label: "4 Weeks", period: four_weeks },
    { label: "12 Weeks", period: twelve_weeks },
    { label: "6 Months", period: six_months },
  ];

  return (
    <Card
      className={cn(
        "flex h-[280px] flex-col gap-0 py-1.5 bg-linear-to-r from-sky-50 via-sky-100 to-sky-200 dark:from-sky-950/20 dark:via-sky-900/40 dark:to-sky-800/50",
        className,
      )}
    >
      <CardHeader className="shrink-0 px-3 pb-1">
        <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
          <div className="rounded bg-sky-500/15 p-0.5 dark:bg-sky-500/20">
            <TrendingUp className="h-3 w-3 text-sky-500" />
          </div>
          Orders vs Sales
          <span className="ml-auto font-normal text-muted-foreground">
            {filtering.week_start} → {filtering.week_end}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-2">
        <div className="grid grid-cols-3 gap-1.5">
          <StatTile label="Sales (Wk)" value={fmt$(current_week.sales)} />
          <StatTile
            label="Blue Line (Wk)"
            value={fmt$(current_week.blue_line_total)}
            valueClass="text-sky-600 dark:text-sky-400"
          />
          <StatTile
            label="Pepsi (Wk)"
            value={current_week.pepsi_total > 0 ? fmt$(current_week.pepsi_total) : "—"}
          />
        </div>

        <table className={cn(TBL, "[&_th]:!bg-muted")}>
          <thead>
            <tr>
              <th className={TH}>Period</th>
              <th className={cn(TH, NUM)}>Blue Line %</th>
              <th className={cn(TH, NUM)}>Pepsi %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className={TD}>{r.label}</td>
                <td
                  className={cn(
                    TD,
                    NUM,
                    "font-medium text-sky-600 dark:text-sky-400",
                  )}
                >
                  {fmtPct(r.period.blue_line_pct)}
                </td>
                <td className={cn(TD, NUM)}>
                  {r.period.pepsi_pct > 0 ? fmtPct(r.period.pepsi_pct) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
