"use client";

import { cn } from "@/lib/utils";
import { Banknote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import type { CashControl } from "@/types/dashboard-report.types";
import { fmt$2, fmtNum, StatTile, WbrCardSkeleton } from "./wbr-format";

function diffColor(n: number) {
  if (n > 0.5) return "text-emerald-600 dark:text-emerald-400";
  if (n < -0.5) return "text-red-600 dark:text-red-400";
  return "";
}

export function WbrCashControlCard({
  data,
  isLoading,
  className,
}: {
  data?: CashControl;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const { filtering, week, period, quarter, year } = data;

  const diffRows = [
    { label: "Week", v: week.deposit_minus_cash_sales },
    { label: "Period", v: period.deposit_minus_cash_sales },
    { label: "Quarter", v: quarter.deposit_minus_cash_sales },
    { label: "Year", v: year.deposit_minus_cash_sales },
  ];

  return (
    <Card
      className={cn(
        "flex h-[280px] flex-col gap-0 py-1.5 bg-linear-to-r from-amber-50 via-amber-100 to-amber-200 dark:from-amber-950/20 dark:via-amber-900/40 dark:to-amber-800/50",
        className,
      )}
    >
      <CardHeader className="shrink-0 px-3 pb-1">
        <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
          <div className="rounded bg-amber-500/15 p-0.5 dark:bg-amber-500/20">
            <Banknote className="h-3 w-3 text-amber-500" />
          </div>
          Cash Control
          <span className="ml-auto font-normal text-muted-foreground">
            {filtering.week_start} · P{filtering.period_number}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-2">
        {/* Week cash + deposit */}
        <div className="grid grid-cols-2 gap-1.5">
          <StatTile label="Cash Sales (Wk)" value={fmt$2(week.cash_sales)} />
          <StatTile label="Deposit (Wk)" value={fmt$2(week.deposit)} />
        </div>

        {/* Deposit − Cash across periods */}
        <table className={cn(TBL, "[&_th]:!bg-muted")}>
          <thead>
            <tr>
              <th className={TH}>Period</th>
              <th className={cn(TH, NUM)}>Deposit − Cash</th>
            </tr>
          </thead>
          <tbody>
            {diffRows.map((r) => (
              <tr key={r.label}>
                <td className={TD}>{r.label}</td>
                <td className={cn(TD, NUM, diffColor(r.v))}>{fmt$2(r.v)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Week order controls */}
        <div className="grid grid-cols-3 gap-1.5">
          <StatTile label="Modified" value={fmtNum(week.modified_orders ?? 0)} />
          <StatTile label="Refunded" value={fmtNum(week.refunded_orders ?? 0)} />
          <StatTile label="Voided" value={fmtNum(week.voided_orders ?? 0)} />
        </div>
      </CardContent>
    </Card>
  );
}
