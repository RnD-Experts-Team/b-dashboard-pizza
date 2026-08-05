"use client";

import { useMemo } from "react";
import { CalendarClock, Sprout, Award } from "lucide-react";
import { V1Empty, V1Metric } from "@/components/dashboard-v1/v1-ui";
import type { ApexOptions } from "apexcharts";
import type { LaborTenure as LaborTenureData, LaborTenureEmployee } from "@/types/labor.types";
import {
  LaborCard,
  PEOPLE,
  ReactApexChart,
  buildTooltipCustom,
  useChartBase,
} from "./labor-chart";
import { DASH, fmtNumber, fmtTenure } from "./labor-format";

function TenureList({
  title,
  icon: Icon,
  people,
  emptyText,
}: {
  title: string;
  icon: typeof Sprout;
  people: LaborTenureEmployee[];
  emptyText: string;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </p>
      {people.length === 0 ? (
        <p className="py-2 text-[11px] text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-0.5">
          {people.map((p) => (
            <li
              key={p.employee_id}
              className="flex items-center justify-between gap-2 border-b border-border/40 py-1 last:border-0"
            >
              <span className="min-w-0 truncate text-[11px] font-medium">
                {p.name}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {fmtTenure(p.tenure_days)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LaborTenure({ tenure }: { tenure: LaborTenureData }) {
  const { base, isDark } = useChartBase();

  // Fixed buckets in a fixed order, zero counts included — render as given.
  const distribution = tenure.distribution;
  const hasAnyTenure = distribution.some((d) => d.count > 0);

  const options: ApexOptions = useMemo(
    () => ({
      ...base,
      chart: { ...base.chart, type: "bar" },
      colors: [PEOPLE.chartColors[0]],
      plotOptions: { bar: { borderRadius: 3, columnWidth: "55%" } },
      dataLabels: {
        enabled: true,
        style: { fontSize: "10px", colors: ["#fff"] },
      },
      xaxis: {
        ...base.xaxis,
        categories: distribution.map((d) => d.bucket),
        labels: { style: { ...base.xaxis?.labels?.style, fontSize: "9px" }, rotate: -35 },
      },
      yaxis: { ...base.yaxis, labels: { formatter: (v: number) => String(Math.round(v)) } },
      tooltip: {
        custom: buildTooltipCustom({ isDark, formatValue: (v) => fmtNumber(v) }),
      },
    }),
    [base, isDark, distribution],
  );

  const series = useMemo(
    () => [{ name: "Employees", data: distribution.map((d) => d.count) }],
    [distribution],
  );

  return (
    <LaborCard title="Tenure" icon={CalendarClock}>
      <div className="space-y-3">
        <V1Metric
          label="Average Tenure"
          value={fmtTenure(tenure.average_tenure_days)}
          sub={
            tenure.average_tenure_days === null
              ? "no active employees"
              : `${Math.round(tenure.average_tenure_days)} days`
          }
          size="lg"
        />

        {distribution.length === 0 || !hasAnyTenure ? (
          <V1Empty icon={CalendarClock}>No tenure data</V1Empty>
        ) : (
          <div className="labor-tenure-chart h-[170px]">
            <ReactApexChart
              options={options}
              series={series}
              type="bar"
              height={170}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TenureList
            title="Newest"
            icon={Sprout}
            people={tenure.newest_hires}
            emptyText={DASH}
          />
          <TenureList
            title="Longest Tenured"
            icon={Award}
            people={tenure.longest_tenured}
            emptyText={DASH}
          />
        </div>
      </div>

      {/* Same fix as labor-headcount.tsx — ApexCharts sets its own inline
          fill on these SVG text nodes, so only an `!important` override
          actually replaces it. */}
      <style jsx global>{`
        .labor-tenure-chart .apexcharts-yaxis-label {
          fill: #18181b !important;
        }
        .dark .labor-tenure-chart .apexcharts-yaxis-label {
          fill: #ffffff !important;
        }
      `}</style>
    </LaborCard>
  );
}
