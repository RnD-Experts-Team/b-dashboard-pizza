"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  ChannelSales,
  ChannelSalesWeek,
} from "@/types/dashboard-report.types";
import {
  fmt$,
  fmtDate,
  Delta,
  pctChangeOrNull,
  WbrCardSkeleton,
} from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import {
  V1Empty,
  V1_TBL,
  V1_TH,
  V1_TD,
  V1_NUM,
} from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1ChannelSalesWeeklyCard — weekly channel sales, current week + Δ vs prev.
 *  Card shows a clean compact table; expand dialog adds the Net Royalty row
 *  and the week date-range footer. Mirrors wbr-channel-sales-card shaping.
 * ────────────────────────────────────────────────────────────────────────── */

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
    <table className={V1_TBL}>
      <thead>
        <tr>
          <th className={V1_TH}>Channel</th>
          <th className={cn(V1_TH, V1_NUM)}>Cur Wk</th>
          <th className={cn(V1_TH, V1_NUM)}>Prev Wk</th>
          <th className={cn(V1_TH, V1_NUM)}>Δ</th>
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
                  V1_TD,
                  r.indent && "pl-5 text-muted-foreground",
                  r.bold && "font-semibold",
                )}
              >
                {r.label}
              </td>
              <td className={cn(V1_TD, V1_NUM, r.bold && "font-semibold")}>
                {fmt$(curr)}
              </td>
              <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>
                {fmt$(prev)}
              </td>
              <td className={cn(V1_TD, V1_NUM)}>
                <Delta value={pctChangeOrNull(curr, prev)} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function V1ChannelSalesWeeklyCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: ChannelSales;
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (isLoading)
    return (
      <div className={["col-span-1 md:col-span-1 lg:col-span-2", className].filter(Boolean).join(" ")}>
        <WbrCardSkeleton />
      </div>
    );
  if (!data)
    return (
      <V1Card title="Channel Sales" category="sales" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const { current_week, previous_week } = data;
  const royaltyRow: Row = {
    label: "Net Royalty",
    get: (w) => w.royalty_obligation,
    bold: true,
  };

  return (
      <V1Card
        title="Channel Sales"
        category="sales"
        period="W"
        span={span}
        className={className}
        bodyClassName="px-0"
        onExpand={() => setOpen(true)}
      >
        <ChannelTable current={current_week} previous={previous_week} />
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
          Current week {fmtDate(current_week.week_start)} →{" "}
          {fmtDate(current_week.week_end)} · Previous week{" "}
          {fmtDate(previous_week.week_start)} →{" "}
          {fmtDate(previous_week.week_end)}
        </p>
      </WbrDetailDialog>
    </V1Card>
  );
}
