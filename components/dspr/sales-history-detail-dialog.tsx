"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import type { ApexOptions } from "apexcharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ChartColumn, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { TBL, TH, TD, NUM, TblWrap } from "@/components/wbr-reports/primitives";
import type { SalesHistory } from "@/types/dashboard-report.types";
import { fmt$, fmtNum, Delta, pctChangeOrNull, StatTile } from "./wbr-format";
import {
  GRANULARITY_OPTIONS,
  CHANNEL_FIELDS,
  METRIC_TABS,
  bucketLabel,
  bucketRangeLabel,
  buildChartCategories,
  buildMetricAreaOptions,
  buildMetricAreaSeries,
  useChannelBreakdown,
  type SalesHistoryGranularity,
  type SalesHistoryBucket,
} from "./sales-history-format";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-90 w-full" />,
});

type View = "total_sales" | "customer_count" | "channels";

interface SalesHistoryDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: SalesHistory;
  initialGranularity: SalesHistoryGranularity;
}

export function SalesHistoryDetailDialog({
  open,
  onOpenChange,
  data,
  initialGranularity,
}: SalesHistoryDetailDialogProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [granularity, setGranularity] = useState<SalesHistoryGranularity>(initialGranularity);
  const [view, setView] = useState<View>("total_sales");

  useEffect(() => {
    if (open) {
      setGranularity(initialGranularity);
      setView("total_sales");
    }
  }, [open, initialGranularity]);

  const buckets = useMemo(() => data[granularity] ?? [], [data, granularity]);
  const latest = buckets[buckets.length - 1];
  const previous = buckets[buckets.length - 2];

  const categories = useMemo(
    () => buildChartCategories(granularity, buckets),
    [buckets, granularity],
  );

  const metricSeries = useMemo(
    () => (view !== "channels" ? buildMetricAreaSeries(buckets, view) : []),
    [buckets, view],
  );

  const metricOptions: ApexOptions | null = useMemo(
    () =>
      view !== "channels"
        ? buildMetricAreaOptions({
            categories,
            buckets,
            granularity,
            isDark,
            height: 340,
            toolbar: false,
            metric: view,
            color: METRIC_TABS.find((m) => m.key === view)!.color,
            showWeekNumber: true,
          })
        : null,
    [categories, buckets, granularity, isDark, view],
  );

  const {
    options: channelOptions,
    series: channelSeries,
    legendItems: channelLegendItems,
    hiddenChannels,
    toggleChannel,
    hasVisible: hasVisibleChannels,
  } = useChannelBreakdown(buckets, categories, isDark, 340, granularity, open);

  const avgTicket = (b?: SalesHistoryBucket) =>
    b && b.customer_count > 0 ? b.total_sales / b.customer_count : 0;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!w-[95vw] !max-w-[80vw] overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-3">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <ChartColumn className="h-4 w-4 text-violet-500" />
              Sales History — Full Breakdown
              {latest && (
                <Badge variant="outline" className="ms-1 gap-1 h-5 py-0 text-[9px] font-normal">
                  <Calendar className="h-2.5 w-2.5" />
                  {bucketRangeLabel(granularity, latest)}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[85vh] overflow-y-auto px-5 py-4">
            {/* ── Controls: granularity + view toggle ─────────────────── */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-0.5 rounded-md bg-muted/60 p-0.5">
                {GRANULARITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={cn(
                      "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                      granularity === opt.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setGranularity(opt.key)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-0.5 rounded-md bg-muted/60 p-0.5">
                {METRIC_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    className={cn(
                      "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                      view === tab.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setView(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
                <button
                  className={cn(
                    "flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                    view === "channels"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setView("channels")}
                >
                  <Layers className="h-3 w-3" /> Channel Breakdown
                </button>
              </div>
            </div>

            {buckets.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-[12px] text-muted-foreground">
                No {granularity} data available
              </div>
            ) : (
              <>
                {/* ── Summary tiles ────────────────────────────────────── */}
                {latest && (
                  <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <StatTile
                      label="Total Sales"
                      value={fmt$(latest.total_sales)}
                      sub={previous && <Delta value={pctChangeOrNull(latest.total_sales, previous.total_sales)} />}
                    />
                    <StatTile
                      label="Customers"
                      value={fmtNum(latest.customer_count)}
                      sub={previous && <Delta value={pctChangeOrNull(latest.customer_count, previous.customer_count)} />}
                    />
                    <StatTile
                      label="Royalty Obligation"
                      value={fmt$(latest.royalty_obligation)}
                      sub={previous && <Delta value={pctChangeOrNull(latest.royalty_obligation, previous.royalty_obligation)} />}
                    />
                    <StatTile
                      label="Avg Ticket"
                      value={fmt$(avgTicket(latest))}
                      sub={previous && <Delta value={pctChangeOrNull(avgTicket(latest), avgTicket(previous))} />}
                    />
                  </div>
                )}

                {/* ── Chart ────────────────────────────────────────────── */}
                {view !== "channels" && metricOptions ? (
                  <ReactApexChart
                    key={`${view}-${isDark ? "dark" : "light"}`}
                    options={metricOptions}
                    series={metricSeries}
                    type="area"
                    height={340}
                  />
                ) : (
                  <>
                    <div className="mb-2 flex flex-wrap items-center gap-x-1 gap-y-1 px-1">
                      {channelLegendItems.map((item) => {
                        const isHidden = hiddenChannels.has(item.key);
                        return (
                          <button
                            key={item.key}
                            onClick={() => toggleChannel(item.key)}
                            className={cn(
                              "flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] transition-colors hover:bg-muted/60",
                              isHidden ? "text-muted-foreground/40 line-through" : "text-muted-foreground",
                            )}
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: item.color, opacity: isHidden ? 0.3 : 1 }}
                            />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                    {hasVisibleChannels ? (
                      <ReactApexChart
                        key={`channels-${isDark ? "dark" : "light"}`}
                        options={channelOptions}
                        series={channelSeries}
                        type="bar"
                        height={340}
                      />
                    ) : (
                      <div className="flex h-85 items-center justify-center text-[12px] text-muted-foreground">
                        No channels selected
                      </div>
                    )}
                  </>
                )}

                {/* ── Data table ───────────────────────────────────────── */}
                <div className="mt-5">
                  <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    All {GRANULARITY_OPTIONS.find((o) => o.key === granularity)?.label}s
                  </h4>
                  <TblWrap tall>
                    <table className={TBL}>
                      <thead>
                        <tr>
                          <th className={TH}>Period</th>
                          <th className={cn(TH, NUM)}>Total Sales</th>
                          <th className={cn(TH, NUM)}>Customers</th>
                          <th className={cn(TH, NUM)}>Royalty</th>
                          {CHANNEL_FIELDS.map((f) => (
                            <th key={f.key} className={cn(TH, NUM)}>{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {buckets.map((b, i) => (
                          <tr key={i}>
                            <td className={TD}>
                              <span className="font-semibold">{bucketLabel(granularity, b)}</span>
                              <span className="ml-1.5 text-[10px] text-muted-foreground">
                                {bucketRangeLabel(granularity, b)}
                              </span>
                            </td>
                            <td className={cn(TD, NUM, "font-medium")}>{fmt$(b.total_sales)}</td>
                            <td className={cn(TD, NUM)}>{fmtNum(b.customer_count)}</td>
                            <td className={cn(TD, NUM)}>{fmt$(b.royalty_obligation)}</td>
                            {CHANNEL_FIELDS.map((f) => (
                              <td key={f.key} className={cn(TD, NUM)}>
                                {fmt$(b[f.key as keyof SalesHistoryBucket] as number)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TblWrap>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
