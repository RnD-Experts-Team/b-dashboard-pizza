"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { V1Card } from "../v1-card";
import { V1Toggle, V1MetricGrid, V1Metric, V1Empty } from "../v1-ui";
import { CATEGORIES } from "../category";
import { CHANNELS, num } from "./channels";
import { useDocumentColorMode } from "@/lib/theme/use-document-color-mode";
import { fmt$, fmtNum, Delta, pctChangeOrNull } from "@/components/dspr/wbr-format";
import {
  GRANULARITY_OPTIONS,
  CHANNEL_FIELDS,
  bucketLabel,
  buildCustomTooltip,
  buildMetricAreaOptions,
  buildMetricAreaSeries,
  type SalesHistoryGranularity,
  type SalesHistoryBucket,
  type SalesHistoryMetricKey,
} from "@/components/dspr/sales-history-format";
import type { SalesHistory } from "@/types/dashboard-report.types";
import { ChartColumn } from "lucide-react";
import { V1SalesHistoryDetailDialog } from "./v1-sales-history-detail";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-36 w-full" />,
});

type View = SalesHistoryMetricKey | "channels";

/** Reuse the same channel→color mapping as the other V1 channel charts. */
const CHANNEL_COLOR_MAP: Record<string, string> = Object.fromEntries(
  CHANNELS.map((c) => [c.key, c.color]),
);

const V1_METRIC_TABS: { key: SalesHistoryMetricKey; label: string }[] = [
  { key: "total_sales", label: "Total Sales" },
  { key: "customer_count", label: "Customers" },
];

/** This card is the one deliberately full-width feature chart on Dashboard V1 — same idea as its counterpart on the main dashboard. */
const CARD_HEIGHT = 400;

export function V1SalesHistoryCard({
  data,
  isLoading,
  span = 4,
  className,
}: {
  data?: SalesHistory;
  isLoading?: boolean;
  span?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const isDark = useDocumentColorMode() === "dark";
  const colors = CATEGORIES.sales.chartColors;
  const [granularity, setGranularity] = useState<SalesHistoryGranularity>("weeks");
  const [view, setView] = useState<View>("total_sales");
  const [hiddenChannels, setHiddenChannels] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const toggleChannel = (key: string) => {
    setHiddenChannels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const buckets = useMemo(() => data?.[granularity] ?? [], [data, granularity]);
  const latest = buckets[buckets.length - 1];
  const previous = buckets[buckets.length - 2];
  const categories = useMemo(
    () => buckets.map((b) => bucketLabel(granularity, b)),
    [buckets, granularity],
  );

  const labelColor = isDark ? "#a1a1aa" : "#71717a";
  const gridColor = isDark ? "#27272a" : "#e4e4e7";
  const axisLineColor = isDark ? "#3f3f46" : "#e4e4e7";

  const metricSeries = useMemo(
    () => (view !== "channels" ? buildMetricAreaSeries(buckets, view) : []),
    [buckets, view],
  );

  const metricOptions: ApexOptions | null = useMemo(
    () =>
      view !== "channels"
        ? buildMetricAreaOptions({
            categories,
            isDark,
            height: 220,
            toolbar: false,
            metric: view,
            color: colors[0],
          })
        : null,
    [categories, isDark, view, colors],
  );

  const visibleFields = useMemo(
    () => CHANNEL_FIELDS.filter((f) => !hiddenChannels.has(f.key)),
    [hiddenChannels],
  );

  const channelSeries = useMemo(
    () =>
      visibleFields.map((f) => ({
        name: f.label,
        type: "column" as const,
        data: buckets.map((b) => num(b[f.key as keyof SalesHistoryBucket] as number)),
      })),
    [buckets, visibleFields],
  );

  const channelOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "bar",
        stacked: false,
        toolbar: { show: false },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: labelColor,
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: visibleFields.map((f) => CHANNEL_COLOR_MAP[f.key] ?? colors[0]),
      plotOptions: { bar: { borderRadius: 2, columnWidth: "80%" } },
      stroke: { width: visibleFields.map(() => 0) },
      dataLabels: { enabled: false },
      fill: { opacity: visibleFields.map(() => 0.9) },
      xaxis: {
        categories,
        labels: { style: { fontSize: "9px", colors: labelColor } },
        axisBorder: { color: axisLineColor },
        axisTicks: { color: axisLineColor },
      },
      yaxis: {
        labels: {
          formatter: (v: number) => (v == null ? "" : `$${(v / 1000).toFixed(0)}k`),
          style: { fontSize: "9px", colors: labelColor },
        },
      },
      legend: { show: false },
      grid: { borderColor: gridColor },
      tooltip: {
        shared: true,
        intersect: false,
        custom: buildCustomTooltip(isDark, categories, (val) => fmt$(val), (i) => {
          const b = buckets[i];
          return b ? { label: "Total Sales", value: fmt$(b.total_sales) } : null;
        }),
      },
    }),
    [categories, isDark, labelColor, gridColor, axisLineColor, visibleFields, buckets, colors],
  );

  if (isLoading) {
    return (
      <V1Card title="Sales History" category="sales" period="W" span={span} height={CARD_HEIGHT} className={className}>
        <Skeleton className="h-full w-full" />
      </V1Card>
    );
  }
  if (!data) return null;

  const hasVisibleChannels = visibleFields.length > 0;

  return (
    <>
      <V1Card
        title="Sales History"
        category="sales"
        period="W"
        span={span}
        height={CARD_HEIGHT}
        className={className}
        onExpand={() => setOpen(true)}
        bodyClassName="overflow-hidden"
        headerControl={
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <V1Toggle
              options={[
                ...V1_METRIC_TABS.map((t) => ({ value: t.key as View, label: t.label })),
                { value: "channels" as const, label: "Channels" },
              ]}
              value={view}
              onChange={setView}
            />
            <V1Toggle
              options={GRANULARITY_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
              value={granularity}
              onChange={setGranularity}
            />
          </div>
        }
      >
        {buckets.length === 0 ? (
          <V1Empty icon={ChartColumn}>No {granularity} data available</V1Empty>
        ) : (
          <div className="flex h-full flex-col gap-1.5">
            {view !== "channels" && metricOptions ? (
              <ReactApexChart
                key={`${view}-${isDark ? "dark" : "light"}`}
                options={metricOptions}
                series={metricSeries}
                type="area"
                height={220}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {CHANNEL_FIELDS.map((f) => {
                    const hidden = hiddenChannels.has(f.key);
                    return (
                      <button
                        key={f.key}
                        onClick={() => toggleChannel(f.key)}
                        className={cn(
                          "flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] transition-colors hover:bg-muted/60",
                          hidden ? "text-muted-foreground/40 line-through" : "text-muted-foreground",
                        )}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: CHANNEL_COLOR_MAP[f.key], opacity: hidden ? 0.3 : 1 }}
                        />
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                {hasVisibleChannels ? (
                  <ReactApexChart
                    key={`ch-${isDark ? "dark" : "light"}`}
                    options={channelOptions}
                    series={channelSeries}
                    type="bar"
                    height={185}
                  />
                ) : (
                  <V1Empty>No channels selected</V1Empty>
                )}
              </>
            )}
            {latest && (
              <V1MetricGrid cols={3}>
                <V1Metric
                  label="Total Sales"
                  value={fmt$(latest.total_sales)}
                  sub={previous && <Delta value={pctChangeOrNull(latest.total_sales, previous.total_sales)} />}
                  accent={CATEGORIES.sales.text}
                />
                <V1Metric
                  label="Customers"
                  value={fmtNum(latest.customer_count)}
                  sub={previous && <Delta value={pctChangeOrNull(latest.customer_count, previous.customer_count)} />}
                />
                <V1Metric
                  label="Royalty"
                  value={fmt$(latest.royalty_obligation)}
                  sub={previous && <Delta value={pctChangeOrNull(latest.royalty_obligation, previous.royalty_obligation)} />}
                />
              </V1MetricGrid>
            )}
          </div>
        )}
      </V1Card>

      <V1SalesHistoryDetailDialog
        open={open}
        onOpenChange={setOpen}
        data={data}
        initialGranularity={granularity}
      />
    </>
  );
}
