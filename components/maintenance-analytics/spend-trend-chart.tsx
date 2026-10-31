"use client";

import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatDateOnly } from "@/lib/utils/date-display";
import { decimalOr0, formatMoney } from "@/lib/maintenance/money";
import { PAYMENT_LINE_TYPES, vocabOptions, vocabText } from "@/lib/maintenance/vocabulary";
import type { FinanceTrendGroup, FinancesTrendPoint } from "@/types/maintenance-system";
import { ChartCard, ChartEmpty, DataTable, FINANCE, PEOPLE, ReactApexChart, useChartInk } from "./chart-kit";

const TYPES = vocabOptions(PAYMENT_LINE_TYPES);
/**
 * One colour per payment line type: the finance ramp and the people ramp
 * interleaved, so neighbouring segments in a stack never share a hue family.
 */
const TYPE_COLORS = [FINANCE[0], PEOPLE[0], FINANCE[1], PEOPLE[1], FINANCE[2], PEOPLE[2]];
const CHART_HEIGHT_PX = 300;
const COLUMN_WIDTH = "60%";

/** "2026-10" → "Oct 2026"; a week's Monday "2026-10-05" → "Oct 5". */
function periodLabel(period: string, by: FinanceTrendGroup): string {
  return by === "month" ? formatDateOnly(`${period}-01`, "MMM yyyy") : formatDateOnly(period, "MMM d");
}

/**
 * Spend over time, stacked by payment line type (docs §8). The SERVER picks
 * the buckets — ISO weeks for ranges up to 92 days, months beyond — and says
 * which; the card shows it as a label, there is nothing to toggle.
 */
export function SpendTrendChart({ trend, trendBy }: { trend: FinancesTrendPoint[]; trendBy: FinanceTrendGroup }) {
  const t = useTranslations("maintenanceSystem");
  const ink = useChartInk();
  const categories = useMemo(() => trend.map((p) => periodLabel(p.period, trendBy)), [trend, trendBy]);
  const series = useMemo(
    () =>
      TYPES.map((type) => ({
        name: vocabText(t, type),
        data: trend.map((p) => decimalOr0(p.byType[type.value])),
      })),
    [trend, t],
  );
  const empty = trend.every((p) => decimalOr0(p.amount) === 0);

  const options: ApexOptions = useMemo(
    () => ({
      chart: { type: "bar", stacked: true, toolbar: { show: false }, fontFamily: "inherit", foreColor: ink.fore, animations: { enabled: false } },
      colors: TYPE_COLORS,
      plotOptions: { bar: { columnWidth: COLUMN_WIDTH } },
      dataLabels: { enabled: false },
      xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { formatter: (v: number) => formatMoney(v) } },
      grid: { borderColor: ink.grid },
      legend: { position: "bottom", horizontalAlign: "center" },
      tooltip: { theme: ink.tooltip, shared: true, intersect: false, y: { formatter: (v: number) => formatMoney(v) } },
    }),
    [categories, ink],
  );

  return (
    <ChartCard
      id="spend-trend"
      icon={TrendingUp}
      title={t("analytics.spendTrend")}
      description={t("analytics.spendTrendHelp")}
      extra={
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {trendBy === "month" ? t("analytics.byMonth") : t("analytics.byWeek")}
        </span>
      }
      chart={() =>
        empty ? (
          <ChartEmpty>{t("analytics.nothingInRange")}</ChartEmpty>
        ) : (
          <figure>
            <figcaption className="sr-only">{t("analytics.spendTrend")}</figcaption>
            <ReactApexChart type="bar" series={series} options={options} height={CHART_HEIGHT_PX} />
          </figure>
        )
      }
      table={() => (
        <DataTable
          head={[trendBy === "month" ? t("analytics.month") : t("analytics.week"), ...TYPES.map((type) => vocabText(t, type)), t("common.total")]}
          rows={trend.map((p, i) => [
            categories[i],
            ...TYPES.map((type) => formatMoney(p.byType[type.value] ?? "0")),
            <strong key="total">{formatMoney(p.amount)}</strong>,
          ])}
          numeric={Array.from({ length: TYPES.length + 1 }, (_, i) => i + 1)}
        />
      )}
    />
  );
}
