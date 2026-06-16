"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import type {
  ChannelSales,
  ChannelSalesWeek,
} from "@/types/dashboard-report.types";
import { fmt$, fmtDate, Delta, pctChangeOrNull } from "./wbr-format";
import { WbrDetailDialog } from "./wbr-detail-dialog";

type Row = {
  label: string;
  get: (w: ChannelSalesWeek) => number;
  bold?: boolean;
  indent?: boolean;
};

const ROWS: Row[] = [
  { label: "Phone", get: (w) => w.phone_sales },
  { label: "Website", get: (w) => w.website_sales.total, bold: true },
  { label: "In-store", get: (w) => w.website_sales.in_store, indent: true },
  { label: "Delivery", get: (w) => w.website_sales.delivery, indent: true },
  { label: "Mobile", get: (w) => w.mobile_sales.total, bold: true },
  { label: "In-store", get: (w) => w.mobile_sales.in_store, indent: true },
  { label: "Delivery", get: (w) => w.mobile_sales.delivery, indent: true },
  { label: "DoorDash", get: (w) => w.doordash_sales },
  { label: "UberEats", get: (w) => w.ubereats_sales },
  { label: "GrubHub", get: (w) => w.grubhub_sales },
];

function ChannelTable({
  current,
  previous,
  extraTop,
}: {
  current: ChannelSalesWeek;
  previous: ChannelSalesWeek;
  extraTop?: Row;
}) {
  const rows = extraTop ? [extraTop, ...ROWS] : ROWS;
  return (
    <table className={cn(TBL, "[&_th]:!bg-muted")}>
      <thead>
        <tr>
          <th className={TH}>Channel</th>
          <th className={cn(TH, NUM)}>Cur Wk</th>
          <th className={cn(TH, NUM)}>Prev Wk</th>
          <th className={cn(TH, NUM)}>Δ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const curr = r.get(current);
          const prev = r.get(previous);
          return (
            <tr key={`${r.label}-${i}`}>
              <td
                className={cn(
                  TD,
                  r.indent && "pl-5 text-muted-foreground",
                  r.bold && "font-semibold",
                )}
              >
                {r.label}
              </td>
              <td className={cn(TD, NUM, r.bold && "font-semibold")}>
                {fmt$(curr)}
              </td>
              <td className={cn(TD, NUM, "text-muted-foreground")}>
                {fmt$(prev)}
              </td>
              <td className={cn(TD, NUM)}>
                <Delta value={pctChangeOrNull(curr, prev)} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function WbrChannelSalesCard({
  data,
  className,
}: {
  data?: ChannelSales;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!data) return null;

  const { current_week, previous_week } = data;
  const royaltyRow: Row = {
    label: "Net Royalty",
    get: (w) => w.royalty_obligation,
    bold: true,
  };

  return (
    <>
      <Card
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-[280px] cursor-pointer flex-col gap-0 py-1.5 transition-shadow hover:shadow-md bg-linear-to-r from-violet-50 via-violet-100 to-violet-200 dark:from-violet-950/20 dark:via-violet-900/40 dark:to-violet-800/50",
          className,
        )}
      >
        <CardHeader className="shrink-0 px-3 pb-1">
          <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
            <div className="rounded bg-violet-500/15 p-0.5 dark:bg-violet-500/20">
              <BarChart2 className="h-3 w-3 text-violet-500" />
            </div>
            Channel Sales
            <span className="ml-auto font-normal text-muted-foreground">
              {fmtDate(data.filtering.week_start)} → {fmtDate(data.filtering.week_end)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0 pb-1">
          <ChannelTable current={current_week} previous={previous_week} />
        </CardContent>
      </Card>

      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Channel Sales — Week over Week"
        badgeText={`${fmtDate(current_week.week_start)} → ${fmtDate(current_week.week_end)}`}
      >
        <ChannelTable
          current={current_week}
          previous={previous_week}
          extraTop={royaltyRow}
        />
        <p className="mt-3 text-[11px] text-muted-foreground">
          Current week {fmtDate(current_week.week_start)} → {fmtDate(current_week.week_end)} ·
          Previous week {fmtDate(previous_week.week_start)} → {fmtDate(previous_week.week_end)}
        </p>
      </WbrDetailDialog>
    </>
  );
}
