"use client";

import { cn } from "@/lib/utils";
import { BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import type { ChannelSales } from "@/types/dashboard-report.types";

const fmt$ = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function WbrChannelSalesCard({
  data,
  className,
}: {
  data?: ChannelSales;
  className?: string;
}) {
  if (!data) return null;

  const { filtering, current_week, previous_week } = data;

  const rows: { label: string; curr: number; prev: number }[] = [
    { label: "Phone", curr: current_week.phone_sales, prev: previous_week.phone_sales },
    { label: "Website", curr: current_week.website_sales.total, prev: previous_week.website_sales.total },
    { label: "Mobile", curr: current_week.mobile_sales.total, prev: previous_week.mobile_sales.total },
    { label: "DoorDash", curr: current_week.doordash_sales, prev: previous_week.doordash_sales },
    { label: "UberEats", curr: current_week.ubereats_sales, prev: previous_week.ubereats_sales },
    { label: "GrubHub", curr: current_week.grubhub_sales, prev: previous_week.grubhub_sales },
  ];

  return (
    <Card className={cn("flex flex-col h-[280px] py-1.5 gap-0", className)}>
      <CardHeader className="pb-1 px-3 shrink-0">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <BarChart2 className="h-3 w-3 text-muted-foreground" />
          Channel Sales
          <span className="font-normal text-muted-foreground ml-auto">
            {filtering.week_start} → {filtering.week_end}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-1 flex-1 overflow-y-auto min-h-0">
        <table className={TBL}>
          <thead>
            <tr>
              <th className={TH}>Channel</th>
              <th className={cn(TH, NUM)}>Cur Wk</th>
              <th className={cn(TH, NUM)}>Prev Wk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className={TD}>{r.label}</td>
                <td className={cn(TD, NUM)}>{fmt$(r.curr)}</td>
                <td className={cn(TD, NUM, "text-muted-foreground")}>{fmt$(r.prev)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
