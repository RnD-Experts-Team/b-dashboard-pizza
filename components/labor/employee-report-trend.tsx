"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { TrendingUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import type { ApexOptions } from "apexcharts";
import type { EmployeeDebriefType } from "@/types/employee-debrief.types";
import type {
  EmployeeReportTrend,
  EmployeeReportTrendWeek,
} from "@/types/employee-report.types";
import {
  LaborCard,
  PEOPLE,
  ReactApexChart,
  buildTooltipCustom,
  useChartBase,
} from "./labor-chart";
import { fmtNumber } from "./labor-format";

const TOTAL_KEY = "total";
const UNTYPED_KEY = "untyped";

function metricKeyForType(type: EmployeeDebriefType | null): string {
  return type === null ? UNTYPED_KEY : `type-${type.id}`;
}

function valueForWeek(week: EmployeeReportTrendWeek, metricKey: string): number | null {
  if (metricKey === TOTAL_KEY) return week.total_count;
  const entry = week.by_type.find((e) => metricKeyForType(e.type) === metricKey);
  return entry?.count ?? null;
}

/**
 * Metric picker is built from the live `debrief_types` catalog (plus Total
 * and the always-present Untyped bucket) — never a hardcoded list of slugs,
 * so a new debrief type shows up here with zero code changes.
 */
export function EmployeeReportTrendChart({
  trend,
  debriefTypes,
}: {
  trend: EmployeeReportTrend;
  debriefTypes: EmployeeDebriefType[];
}) {
  const { base, isDark } = useChartBase();
  const [metricKey, setMetricKey] = useState<string>(TOTAL_KEY);

  const metricOptions = useMemo(
    () => [
      { key: TOTAL_KEY, label: "Total" },
      ...debriefTypes.map((t) => ({ key: metricKeyForType(t), label: t.label })),
      { key: UNTYPED_KEY, label: "Untyped" },
    ],
    [debriefTypes],
  );

  const weeks = trend.weeks;
  const metricLabel = metricOptions.find((o) => o.key === metricKey)?.label ?? "Total";

  const options: ApexOptions = useMemo(
    () => ({
      ...base,
      chart: { ...base.chart, type: "line" },
      colors: [PEOPLE.chartColors[0]],
      stroke: { curve: "smooth", width: 2.5 },
      markers: { size: 4, strokeWidth: 2, hover: { size: 6 } },
      xaxis: {
        ...base.xaxis,
        categories: weeks.map((w) => format(parseISO(w.week_start), "MMM d")),
      },
      yaxis: {
        ...base.yaxis,
        labels: { style: { fontSize: "10px" }, formatter: (v: number) => fmtNumber(v) },
      },
      tooltip: {
        custom: buildTooltipCustom({ isDark, formatValue: (v) => fmtNumber(v) }),
      },
    }),
    [base, isDark, weeks],
  );

  const series = useMemo(
    () => [
      {
        name: metricLabel,
        // Apex renders `null` as a gap — right for "no data that week".
        data: weeks.map((w) => valueForWeek(w, metricKey)),
      },
    ],
    [weeks, metricKey, metricLabel],
  );

  return (
    <LaborCard
      title="Debrief Trend"
      icon={TrendingUp}
      action={
        weeks.length > 0 ? (
          <Select value={metricKey} onValueChange={setMetricKey}>
            <SelectTrigger size="sm" className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {metricOptions.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined
      }
    >
      {weeks.length === 0 ? (
        <V1Empty icon={TrendingUp}>No trailing week data</V1Empty>
      ) : (
        <div className="employee-report-trend-chart h-[220px] overflow-hidden">
          <ReactApexChart options={options} series={series} type="line" height={220} />
        </div>
      )}

      {/* Same fix as labor-trend.tsx — ApexCharts sets its own inline fill on
          these SVG text nodes, so only an `!important` override replaces it. */}
      <style jsx global>{`
        .employee-report-trend-chart .apexcharts-yaxis-label {
          fill: #18181b !important;
        }
        .dark .employee-report-trend-chart .apexcharts-yaxis-label {
          fill: #ffffff !important;
        }
      `}</style>
    </LaborCard>
  );
}
