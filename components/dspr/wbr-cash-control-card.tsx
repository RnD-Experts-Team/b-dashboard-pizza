"use client";

import { cn } from "@/lib/utils";
import { Banknote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import type { CashControl } from "@/types/dashboard-report.types";

const fmt$ = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function overShortColor(n: number) {
  if (n > 0.5) return "text-emerald-600 dark:text-emerald-400";
  if (n < -0.5) return "text-red-600 dark:text-red-400";
  return "";
}

export function WbrCashControlCard({
  data,
  className,
}: {
  data?: CashControl;
  className?: string;
}) {
  if (!data) return null;

  const { filtering } = data;

  const rows = [
    { label: "Week", d: data.week },
    { label: "Period", d: data.period },
    { label: "Quarter", d: data.quarter },
  ];

  return (
    <Card className={cn("flex flex-col h-[280px] py-1.5 gap-0 bg-linear-to-r from-amber-50 via-amber-100 to-amber-200 dark:from-amber-950/20 dark:via-amber-900/40 dark:to-amber-800/50", className)}>
      <CardHeader className="pb-1 px-3 shrink-0">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-amber-500/15 dark:bg-amber-500/20">
            <Banknote className="h-3 w-3 text-amber-500" />
          </div>
          Cash Control
          <span className="font-normal text-muted-foreground ml-auto">
            {filtering.week_start} · P{filtering.period_number}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-1 flex-1 overflow-y-auto min-h-0">
        <table className={cn(TBL, "[&_th]:!bg-muted/60")}>
          <thead>
            <tr>
              <th className={TH}>Period</th>
              <th className={cn(TH, NUM)}>Cash</th>
              <th className={cn(TH, NUM)}>Deposit</th>
              <th className={cn(TH, NUM)}>O/S</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className={TD}>{r.label}</td>
                <td className={cn(TD, NUM)}>{fmt$(r.d.cash_sales)}</td>
                <td className={cn(TD, NUM)}>{fmt$(r.d.deposit)}</td>
                <td className={cn(TD, NUM, overShortColor(r.d.over_short))}>
                  {fmt$(r.d.over_short)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
