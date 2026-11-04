"use client";

import { useMemo } from "react";
import { Award, CalendarClock, Sprout, type LucideIcon } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric } from "@/components/dashboard-v1/v1-ui";
import { DASH, fmtNumber, fmtTenure } from "@/components/labor/labor-format";
import { ApexChart, useChartTheme } from "@/components/business-reports/chart";
import { useReport } from "@/components/business-reports/report-context";
import type { LaborBlock, LaborReport } from "@/types/business-reports.types";
import { ROW_CARD_HEIGHT, StoreTag, peopleBarOptions } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Tenure — average tenure, the bucket distribution and the newest /
 *  longest-tenured employees across every loaded store.
 * ────────────────────────────────────────────────────────────────────────── */

const CHART_PX = 140;

type TenurePerson = NonNullable<LaborBlock["tenure"]["newest_hires"]>[number];

function TenureList({ title, icon: Icon, people }: { title: string; icon: LucideIcon; people: TenurePerson[] }) {
  const { storeName } = useReport();
  return (
    <div className="min-w-0">
      <p className="mb-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </p>
      {people.length === 0 ? (
        <p className="py-1 text-[11px] text-muted-foreground">{DASH}</p>
      ) : (
        <ul>
          {people.map((p) => (
            <li
              key={`${p.store}-${p.employee_id}`}
              className="flex items-center justify-between gap-2 border-b border-border/40 py-0.5 last:border-0"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[11px] font-medium">{p.name}</span>
                <StoreTag>{storeName(p.store)}</StoreTag>
              </span>
              <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">{fmtTenure(p.tenure_days)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BrTenure({ data }: { data: LaborReport }) {
  const theme = useChartTheme();
  const t = data.combined.tenure;
  const distribution = t.distribution;
  const hasAny = distribution.some((d) => d.count > 0);

  const options = useMemo(
    () => peopleBarOptions(theme, distribution.map((d) => d.bucket), (v) => fmtNumber(v), false),
    [theme, distribution],
  );
  const series = useMemo(() => [{ name: "Employees", data: distribution.map((d) => d.count) }], [distribution]);

  return (
    <V1Card reportId="br-tenure" title="Tenure" category="people" period="R" span={1} height={ROW_CARD_HEIGHT}>
      <div className="space-y-1.5">
        <V1Metric
          label="Average Tenure"
          value={fmtTenure(t.average_tenure_days)}
          sub={t.average_tenure_days === null ? "no active employees" : `${fmtNumber(t.average_tenure_days)} days`}
        />
        {hasAny ? (
          <ApexChart key={theme.key} options={options} series={series} type="bar" height={CHART_PX} />
        ) : (
          <div className="h-16">
            <V1Empty icon={CalendarClock}>No tenure data</V1Empty>
          </div>
        )}
        <TenureList title="Newest" icon={Sprout} people={t.newest_hires ?? []} />
        <TenureList title="Longest Tenured" icon={Award} people={t.longest_tenured ?? []} />
      </div>
    </V1Card>
  );
}
