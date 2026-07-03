"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import type { ApexOptions } from "apexcharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChartColumn, Layers } from "lucide-react";
import type { SalesHistory } from "@/types/dashboard-report.types";
import { WbrCardSkeleton } from "./wbr-format";
import {
  GRANULARITY_OPTIONS,
  METRIC_TABS,
  bucketLabel,
  buildMetricAreaOptions,
  buildMetricAreaSeries,
  useChannelBreakdown,
  type SalesHistoryGranularity,
} from "./sales-history-format";
import { SalesHistoryDetailDialog } from "./sales-history-detail-dialog";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-65 w-full" />,
});

interface SalesHistoryCardProps {
  data?: SalesHistory;
  isLoading?: boolean;
  className?: string;
}

type View = "total_sales" | "customer_count" | "channels";

export function SalesHistoryCard({ data, isLoading, className }: SalesHistoryCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [granularity, setGranularity] = useState<SalesHistoryGranularity>("weeks");
  const [view, setView] = useState<View>("total_sales");
  const [dialogOpen, setDialogOpen] = useState(false);

  const buckets = useMemo(() => data?.[granularity] ?? [], [data, granularity]);

  const categories = useMemo(
    () => buckets.map((b) => bucketLabel(granularity, b)),
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
            height: 260,
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
  } = useChannelBreakdown(buckets, categories, isDark, 260, granularity, granularity);

  if (isLoading) return <WbrCardSkeleton className={cn("h-[400px]", className)} />;
  if (!data) return null;

  return (
    <>
      <Card
        className={cn(
          "group cursor-pointer gap-0 py-1.5 transition-shadow hover:shadow-md dspr-card-hover bg-linear-to-r from-violet-50 via-violet-100 to-violet-200 dark:from-violet-950/20 dark:via-violet-900/20 dark:to-violet-800/20",
          className,
        )}
        onClick={() => setDialogOpen(true)}
      >
        <CardHeader className="pb-0 px-3">
          <CardTitle className="flex flex-wrap items-center gap-1 text-[11px] font-semibold">
            <div className="rounded p-0.5 bg-violet-500/15 dark:bg-violet-500/20">
              <ChartColumn className="h-3 w-3 text-violet-500" />
            </div>
            Sales History
            <div
              className="ms-auto flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-0.5 rounded-md bg-muted/60 p-0.5">
                {METRIC_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors",
                      view === tab.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setView(tab.key);
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
                <button
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors",
                    view === "channels"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setView("channels");
                  }}
                >
                  <Layers className="h-2.5 w-2.5" /> Channels
                </button>
              </div>
              <div className="flex gap-0.5 rounded-md bg-muted/60 p-0.5">
                {GRANULARITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors",
                      granularity === opt.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setGranularity(opt.key);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent
          className="cursor-default border-t-3 border-border/40 px-3 pb-2"
          onClick={(e) => e.stopPropagation()}
        >
          {buckets.length === 0 ? (
            <div className="flex h-65 items-center justify-center text-[11px] text-muted-foreground">
              No {granularity} data available
            </div>
          ) : (
            <>
              {view !== "channels" && metricOptions ? (
                <ReactApexChart
                  key={`${view}-${isDark ? "dark" : "light"}`}
                  options={metricOptions}
                  series={metricSeries}
                  type="area"
                  height={260}
                />
              ) : (
                <>
                  <div className="mb-1.5 flex flex-wrap items-center gap-x-1 gap-y-1">
                    {channelLegendItems.map((item) => {
                      const isHidden = hiddenChannels.has(item.key);
                      return (
                        <button
                          key={item.key}
                          onClick={() => toggleChannel(item.key)}
                          className={cn(
                            "flex items-center gap-1 rounded px-1 py-0.5 text-[9px] transition-colors hover:bg-muted/60",
                            isHidden ? "text-muted-foreground/40 line-through" : "text-muted-foreground",
                          )}
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
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
                      height={260}
                    />
                  ) : (
                    <div className="flex h-65 items-center justify-center text-[11px] text-muted-foreground">
                      No channels selected
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <SalesHistoryDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        data={data}
        initialGranularity={granularity}
      />
    </>
  );
}
