"use client";

import { cn } from "@/lib/utils";
import { Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import type { PhoneAndAdjustedSales } from "@/types/dashboard-report.types";

const fmt$ = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function WbrPhoneSalesCard({
  data,
  className,
}: {
  data?: PhoneAndAdjustedSales;
  className?: string;
}) {
  if (!data) return null;

  const { filtering } = data;

  const rows = [
    { label: "Week", phone: data.week.current.phone_sales, adj: data.week.current.adjusted_royalty_obligation },
    { label: "Period", phone: data.period.current.phone_sales, adj: data.period.current.adjusted_royalty_obligation },
    { label: "Quarter", phone: data.quarter.current.phone_sales, adj: data.quarter.current.adjusted_royalty_obligation },
  ];

  return (
    <Card className={cn("flex flex-col h-[280px] py-1.5 gap-0 bg-linear-to-r from-sky-50 via-sky-100 to-sky-200 dark:from-sky-950/20 dark:via-sky-900/40 dark:to-sky-800/50", className)}>
      <CardHeader className="pb-1 px-3 shrink-0">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-sky-500/15 dark:bg-sky-500/20">
            <Phone className="h-3 w-3 text-sky-500" />
          </div>
          Phone &amp; Adj. Sales
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
              <th className={cn(TH, NUM)}>Phone</th>
              <th className={cn(TH, NUM)}>Adj. Royalty</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className={TD}>{r.label}</td>
                <td className={cn(TD, NUM)}>{fmt$(r.phone)}</td>
                <td className={cn(TD, NUM)}>{fmt$(r.adj)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
