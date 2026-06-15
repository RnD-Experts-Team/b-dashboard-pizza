"use client";

import { cn } from "@/lib/utils";
import { Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import type { Promo } from "@/types/dashboard-report.types";

const fmt$ = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function stripPrefix(reason: string): string {
  return reason.replace(/^Punchh promo code:\s*/i, "").trim();
}

export function WbrPromoCard({
  data,
  className,
}: {
  data?: Promo;
  className?: string;
}) {
  if (!data) return null;

  const { filtering, current_week } = data;

  return (
    <Card className={cn("flex flex-col h-[280px] py-1.5 gap-0", className)}>
      <CardHeader className="pb-1 px-3 shrink-0">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <Tag className="h-3 w-3 text-muted-foreground" />
          Promos
          <span className="font-normal text-muted-foreground">
            · {fmtPct(current_week.promo_totals.pct_of_store_sales)} of sales
          </span>
          <span className="font-normal text-muted-foreground ml-auto">
            {filtering.week_start} → {filtering.week_end}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-1 flex-1 overflow-y-auto min-h-0">
        <table className={TBL}>
          <thead>
            <tr>
              <th className={TH}>Code</th>
              <th className={cn(TH, NUM)}>Sales</th>
              <th className={cn(TH, NUM)}>%</th>
            </tr>
          </thead>
          <tbody>
            {current_week.promo_breakdown.map((p, i) => (
              <tr key={i}>
                <td className={cn(TD, "max-w-[140px] truncate")} title={stripPrefix(p.modification_reason)}>
                  {stripPrefix(p.modification_reason)}
                </td>
                <td className={cn(TD, NUM)}>{fmt$(p.promo_sales)}</td>
                <td className={cn(TD, NUM, "text-muted-foreground")}>{fmtPct(p.pct_of_store_sales)}</td>
              </tr>
            ))}
            <tr className="font-semibold border-t-2">
              <td className={TD}>Total</td>
              <td className={cn(TD, NUM)}>{fmt$(current_week.promo_totals.total_promo_sales)}</td>
              <td className={cn(TD, NUM)}>{fmtPct(current_week.promo_totals.pct_of_store_sales)}</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
