"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CustomerCountAndSales, PhoneAndAdjustedSales } from "@/types/dashboard-report.types";
import { fmt$, fmtNum, Delta, pctChangeOrNull, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Toggle, V1Empty, V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1SalesGuestsChannelsCard — Customer & Sales and Phone & In-Store in one
 *  card: periods as rows (week, period, quarter, YTD), Sales / Guests / Phone
 *  / In-Store as columns, each with its change against the previous period or
 *  last year. The baseline amount is in each cell's tooltip.
 * ────────────────────────────────────────────────────────────────────────── */

type CmpMode = "previous" | "yoy";
type Values = Record<string, number>;

const MONTHS_PER_QUARTER = 3;
/** Below this, amounts are whole dollars ("$551"); from it, one decimal of the compact unit ("$12.3K"). */
const COMPACT_DECIMAL_FROM = 1000;

/** "$12.3K" — four money columns have to fit one card. */
const fmtCompact$ = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: Math.abs(n) >= COMPACT_DECIMAL_FROM ? 1 : 0,
  });

const METRICS = [
  { key: "total_sales", label: "Sales", fmt: fmtCompact$, full: fmt$ },
  { key: "customer_count", label: "Guests", fmt: fmtNum, full: fmtNum },
  { key: "phone_sales", label: "Phone", fmt: fmtCompact$, full: fmt$ },
  { key: "adjusted_royalty_obligation", label: "In-Store", fmt: fmtCompact$, full: fmt$ },
] as const;

interface Row {
  label: string;
  current: Values;
  baseline: Values;
}

type Periods<T> = { current: T; previous: T };

function merged<A, B>(a: A | undefined, b: B | undefined): Values {
  return { ...(a ?? {}), ...(b ?? {}) } as Values;
}

export function V1SalesGuestsChannelsCard({
  customers,
  channels,
  isLoading,
  span = 1,
  className,
}: {
  customers?: CustomerCountAndSales;
  channels?: PhoneAndAdjustedSales;
  isLoading?: boolean;
  span?: V1Span;
  className?: string;
}) {
  const [mode, setMode] = useState<CmpMode>("previous");

  if (isLoading) return <WbrCardSkeleton className={className} />;
  const filtering = customers?.filtering ?? channels?.filtering;
  if (!filtering)
    return (
      <V1Card title="Sales, Guests & Channels" category="sales" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const yoy = mode === "yoy";
  const pick = <T,>(p: Periods<T> | undefined, lastYear: T | undefined) => (yoy ? lastYear : p?.previous);
  const rows: Row[] = [
    {
      label: `Wk ${filtering.week_number}`,
      current: merged(customers?.week.current, channels?.week.current),
      baseline: merged(
        pick(customers?.week, customers?.week.same_week_last_year),
        pick(channels?.week, channels?.week.same_week_last_year),
      ),
    },
    {
      label: `P${filtering.period_number}`,
      current: merged(customers?.period.current, channels?.period.current),
      baseline: merged(
        pick(customers?.period, customers?.period.same_period_last_year),
        pick(channels?.period, channels?.period.same_period_last_year),
      ),
    },
    {
      label: `Q${Math.ceil(filtering.period_number / MONTHS_PER_QUARTER)}`,
      current: merged(customers?.quarter.current, channels?.quarter.current),
      baseline: merged(
        pick(customers?.quarter, customers?.quarter.same_quarter_last_year),
        pick(channels?.quarter, channels?.quarter.same_quarter_last_year),
      ),
    },
    {
      // YTD always compares with last year's same days.
      label: "YTD",
      current: merged(customers?.year.current, channels?.year.current),
      baseline: merged(customers?.year.previous, channels?.year.previous),
    },
  ];
  const baseLabel = yoy ? "Last year" : "Previous";

  return (
    <V1Card
      title="Sales, Guests & Channels"
      category="sales"
      period="W"
      span={span}
      className={className}
      bodyClassName="px-0 overflow-x-hidden"
      reportId="sales-guests-channels"
      headerControl={
        <V1Toggle<CmpMode>
          className="ms-1"
          value={mode}
          onChange={setMode}
          options={[
            { value: "previous", label: "Prev" },
            { value: "yoy", label: "YoY" },
          ]}
        />
      }
    >
      <table className={cn(V1_TBL, "[&_th]:!px-1 [&_th]:!py-1.5 [&_td]:!px-1 [&_td]:!py-1.5")}>
        <thead>
          <tr>
            <th className={cn(V1_TH, "w-9")} />
            {METRICS.map((m) => (
              <th key={m.key} className={cn(V1_TH, V1_NUM, "font-semibold text-foreground/80")}>
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className={cn(V1_TD, "font-semibold text-foreground/70")}>{r.label}</td>
              {METRICS.map((m) => {
                const curr = r.current[m.key];
                const base = r.baseline[m.key];
                return (
                  <td
                    key={m.key}
                    className={cn(V1_TD, V1_NUM)}
                    title={curr === undefined ? undefined : `${m.full(curr)} · ${baseLabel} ${m.full(base ?? 0)}`}
                  >
                    <div className="font-semibold tabular-nums leading-tight">{curr === undefined ? "—" : m.fmt(curr)}</div>
                    <div className="flex justify-end [&>span]:!px-1 [&>span]:!py-0 [&>span]:!text-[9px] [&>span_svg]:!h-2 [&>span_svg]:!w-2">
                      <Delta value={curr === undefined ? null : pctChangeOrNull(curr, base ?? 0)} />
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </V1Card>
  );
}
