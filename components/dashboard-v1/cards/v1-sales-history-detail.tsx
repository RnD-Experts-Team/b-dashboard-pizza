"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Toggle, V1MetricGrid, V1Metric, V1_TBL, V1_TH, V1_TD, V1_NUM } from "../v1-ui";
import { CATEGORIES } from "../category";
import { CHANNELS, num } from "./channels";
import { useDocumentColorMode } from "@/lib/theme/use-document-color-mode";
import { fmt$, fmtNum, Delta, pctChangeOrNull } from "@/components/dspr/wbr-format";
import {
  GRANULARITY_OPTIONS,
  CHANNEL_FIELDS,
  bucketLabel,
  bucketRangeLabel,
  buildCustomTooltip,
  buildMetricAreaOptions,
  buildMetricAreaSeries,
  type SalesHistoryGranularity,
  type SalesHistoryBucket,
  type SalesHistoryMetricKey,
} from "@/components/dspr/sales-history-format";
import type { SalesHistory } from "@/types/dashboard-report.types";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full" />,
});

type View = SalesHistoryMetricKey | "channels";

const CHANNEL_COLOR_MAP: Record<string, string> = Object.fromEntries(
  CHANNELS.map((c) => [c.key, c.color]),
);

const V1_METRIC_TABS: { key: SalesHistoryMetricKey; label: string }[] = [
  { key: "total_sales", label: "Total Sales" },
  { key: "customer_count", label: "Customers" },
];

interface V1SalesHistoryDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: SalesHistory;
  initialGranularity: SalesHistoryGranularity;
}

export function V1SalesHistoryDetailDialog({
  open,
  onOpenChange,
  data,
  initialGranularity,
}: V1SalesHistoryDetailDialogProps) {
  const isDark = useDocumentColorMode() === "dark";
  const colors = CATEGORIES.sales.chartColors;
  const [granularity, setGranularity] = useState<SalesHistoryGranularity>(initialGranularity);
  const [view, setView] = useState<View>("total_sales");
  const [hiddenChannels, setHiddenChannels] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setGranularity(initialGranularity);
      setView("total_sales");
      setHiddenChannels(new Set());
    }
  }, [open, initialGranularity]);

  const toggleChannel = (key: string) => {
    setHiddenChannels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const buckets = useMemo(() => data[granularity] ?? [], [data, granularity]);
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
            height: 320,
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
        height: 320,
        stacked: false,
        toolbar: { show: false },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: labelColor,
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: visibleFields.map((f) => CHANNEL_COLOR_MAP[f.key] ?? colors[0]),
      plotOptions: { bar: { borderRadius: 2, columnWidth: "85%" } },
      stroke: { width: visibleFields.map(() => 0) },
      dataLabels: { enabled: false },
      fill: { opacity: visibleFields.map(() => 0.9) },
      xaxis: {
        categories,
        labels: { style: { fontSize: "10px", colors: labelColor } },
        axisBorder: { color: axisLineColor },
        axisTicks: { color: axisLineColor },
      },
      yaxis: {
        labels: {
          formatter: (v: number) => (v == null ? "" : `$${v.toLocaleString()}`),
          style: { fontSize: "10px", colors: labelColor },
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

  const avgTicket = (b?: SalesHistoryBucket) =>
    b && b.customer_count > 0 ? b.total_sales / b.customer_count : 0;
  const hasVisibleChannels = visibleFields.length > 0;

  return (
    <WbrDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className={cn("flex items-center gap-1.5", CATEGORIES.sales.text)}>
          Sales History — Full Breakdown
        </span>
      }
      badgeText={latest ? bucketRangeLabel(granularity, latest) : undefined}
      className="sm:max-w-6xl"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <V1Toggle
          options={GRANULARITY_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
          value={granularity}
          onChange={setGranularity}
        />
        <V1Toggle
          options={[
            ...V1_METRIC_TABS.map((t) => ({ value: t.key as View, label: t.label })),
            { value: "channels" as const, label: "Channel Breakdown" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {buckets.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-[12px] text-muted-foreground">
          No {granularity} data available
        </div>
      ) : (
        <>
          {latest && (
            <V1MetricGrid cols={4} className="mb-4">
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
                label="Royalty Obligation"
                value={fmt$(latest.royalty_obligation)}
                sub={previous && <Delta value={pctChangeOrNull(latest.royalty_obligation, previous.royalty_obligation)} />}
              />
              <V1Metric
                label="Avg Ticket"
                value={fmt$(avgTicket(latest))}
                sub={previous && <Delta value={pctChangeOrNull(avgTicket(latest), avgTicket(previous))} />}
              />
            </V1MetricGrid>
          )}

          {view !== "channels" && metricOptions ? (
            <ReactApexChart
              key={`${view}-${isDark ? "dark" : "light"}`}
              options={metricOptions}
              series={metricSeries}
              type="area"
              height={320}
            />
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-x-1 gap-y-1">
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
                  height={320}
                />
              ) : (
                <div className="flex h-80 items-center justify-center text-[12px] text-muted-foreground">
                  No channels selected
                </div>
              )}
            </>
          )}

          <div className="mt-5">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              All {GRANULARITY_OPTIONS.find((o) => o.key === granularity)?.label}s
            </h4>
            <div className="max-h-[420px] w-full overflow-auto rounded-md border border-border/50">
              <table className={V1_TBL}>
                <thead>
                  <tr>
                    <th className={V1_TH}>Period</th>
                    <th className={cn(V1_TH, V1_NUM)}>Total Sales</th>
                    <th className={cn(V1_TH, V1_NUM)}>Customers</th>
                    <th className={cn(V1_TH, V1_NUM)}>Royalty</th>
                    {CHANNEL_FIELDS.map((f) => (
                      <th key={f.key} className={cn(V1_TH, V1_NUM)}>{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((b, i) => (
                    <tr key={i}>
                      <td className={V1_TD}>
                        <span className="font-semibold">{bucketLabel(granularity, b)}</span>
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          {bucketRangeLabel(granularity, b)}
                        </span>
                      </td>
                      <td className={cn(V1_TD, V1_NUM, "font-medium")}>{fmt$(b.total_sales)}</td>
                      <td className={cn(V1_TD, V1_NUM)}>{fmtNum(b.customer_count)}</td>
                      <td className={cn(V1_TD, V1_NUM)}>{fmt$(b.royalty_obligation)}</td>
                      {CHANNEL_FIELDS.map((f) => (
                        <td key={f.key} className={cn(V1_TD, V1_NUM)}>
                          {fmt$(num(b[f.key as keyof SalesHistoryBucket] as number))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </WbrDetailDialog>
  );
}
