"use client";

import { cn } from "@/lib/utils";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeltaBadge, TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import type { CustomerCountAndSales } from "@/types/dashboard-report.types";

const fmt$ = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtNum = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

function pctChange(curr: number, prev: number): number {
  if (!prev) return 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function WbrCustomerSalesCard({
  data,
  className,
}: {
  data?: CustomerCountAndSales;
  className?: string;
}) {
  if (!data) return null;

  const { filtering, week, period } = data;

  const rows = [
    { label: "Wk (cur)", sales: week.current.total_sales, customers: week.current.customer_count, delta: null as number | null },
    { label: "Wk (prev)", sales: week.previous.total_sales, customers: week.previous.customer_count, delta: pctChange(week.current.total_sales, week.previous.total_sales) },
    { label: "Pd (cur)", sales: period.current.total_sales, customers: period.current.customer_count, delta: null },
    { label: "Pd (prev)", sales: period.previous.total_sales, customers: period.previous.customer_count, delta: pctChange(period.current.total_sales, period.previous.total_sales) },
  ];

  return (
    <Card className={cn("flex flex-col h-[280px] py-1.5 gap-0 bg-linear-to-r from-blue-50 via-blue-100 to-blue-200 dark:from-blue-950/20 dark:via-blue-900/40 dark:to-blue-800/50", className)}>
      <CardHeader className="pb-1 px-3 shrink-0">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-blue-500/15 dark:bg-blue-500/20">
            <Users className="h-3 w-3 text-blue-500" />
          </div>
          Customer &amp; Sales
          <span className="font-normal text-muted-foreground ml-auto">
            {filtering.date} · Wk {filtering.week_number}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-1 flex-1 overflow-y-auto min-h-0">
        <table className={cn(TBL, "[&_th]:!bg-muted/60")}>
          <thead>
            <tr>
              <th className={TH}>Period</th>
              <th className={cn(TH, NUM)}>Sales</th>
              <th className={cn(TH, NUM)}>Guests</th>
              <th className={cn(TH, NUM)}>WoW</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className={TD}>{r.label}</td>
                <td className={cn(TD, NUM)}>{fmt$(r.sales)}</td>
                <td className={cn(TD, NUM)}>{fmtNum(r.customers)}</td>
                <td className={cn(TD, NUM)}>
                  {r.delta !== null ? <DeltaBadge value={r.delta} /> : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
