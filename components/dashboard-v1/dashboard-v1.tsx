"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { format, subDays, formatDistanceToNow, getISOWeek, parseISO } from "date-fns";
import html2canvas from "html2canvas-pro";
import { useWbrCard } from "@/lib/hooks/use-wbr-card";
import { useManagerDashboard } from "@/lib/hooks/use-manager-dashboard";
import { useHooksWbr } from "@/lib/hooks/use-hooks-wbr";
import { StoreGoals, DsprDashboardSkeleton, DaySummaryStats } from "@/components/dspr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Store,
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Camera,
  RefreshCw,
  ShieldAlert,
  Pizza,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Section } from "./v1-section";
import {
  V1SalesTrendCard,
  V1ChannelMixCard,
  V1HourlyChannelsCard,
  V1StoreScoreCard,
  V1CustomerSalesCard,
  V1PhoneSalesCard,
  V1ChannelSalesWeeklyCard,
  V1OrdersVsSalesCard,
  V1PortalGaugeCard,
  V1HnrCard,
  V1LaborCard,
  V1GoToCard,
  V1PortalWeeklyCard,
  V1NonNegotiableCard,
  V1TopItemsCard,
  V1TopIngredientsCard,
  V1PromoCard,
  V1LtoCard,
  V1CurrentEmployeesCard,
  V1BirthdayCard,
  V1HighHoursCard,
  V1AveragePayCard,
  V1CashControlCard,
  V1TransferInOutCard,
  V1MoneyOwedCard,
  V1ComplaintsCard,
  V1FeedbacksCard,
  V1QaRatingsCard,
  V1MaintenanceCard,
} from "./cards";

/** Format a Date to YYYY-MM-DD (API-compatible format) */
function toApiDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function ForbiddenWelcomeScreen() {
  return (
    <Card className="overflow-hidden border">
      <CardContent className="p-5 sm:p-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 ring-1 ring-orange-400/30 sm:h-20 sm:w-20">
            <Pizza className="h-8 w-8 text-orange-600 sm:h-10 sm:w-10" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-3xl">
            Welcome to Pizza Dashboard
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Here you can see details about your stores.
          </p>
          <div className="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <a
                href="https://tasks.rdexperts.tech/support-ticket"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="me-2 h-4 w-4" />
                Contact Support
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Dashboard V1 — an optimized, color-organized take on the DSPR dashboard.
 * Reuses the exact same data wiring as DsprDashboard (same hooks, store, date,
 * endpoints) and lays widgets out in labeled, color-coded category sections
 * built from a unified card system.
 */
export function DashboardV1() {
  const {
    data,
    wbrData,
    isLoading,
    isRefreshing,
    error,
    lastFetchedAt,
    refetch,
    refresh,
    isStale,
    selectedStore,
  } = useWbrCard();

  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const [selectedDate, setSelectedDate] = useState<Date>(subDays(new Date(), 1));
  const [dateOpen, setDateOpen] = useState(false);

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      setSelectedDate(date);
      setDateOpen(false);
      refetch(toApiDate(date));
    },
    [refetch],
  );

  const storeId = selectedStore?.storeId ?? selectedStore?.id ?? null;
  const storeNumericId = selectedStore?.id ?? null;
  const selectedDateRef = useRef(selectedDate);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    if (storeId) {
      refetch(toApiDate(selectedDateRef.current));
    }
  }, [storeId, refetch]);

  const managerDashboard = useManagerDashboard(storeId, toApiDate(selectedDate));
  const hooksWbr = useHooksWbr(storeId, toApiDate(selectedDate));

  const handleRefreshAll = useCallback(() => {
    refetch(toApiDate(selectedDate));
    managerDashboard.refetch();
    hooksWbr.refetch();
  }, [refetch, selectedDate, managerDashboard, hooksWbr]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastFetchedAt) return null;
    return formatDistanceToNow(lastFetchedAt, { addSuffix: true });
  }, [lastFetchedAt]);

  // ── Screenshot ────────────────────────────────────────────────────────
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleScreenshot = useCallback(async () => {
    if (!dashboardRef.current || isCapturing) return;
    setIsCapturing(true);
    const node = dashboardRef.current;
    const btn = node.querySelector<HTMLElement>("[data-screenshot-btn]");
    const ignored = node.querySelectorAll<HTMLElement>("[data-screenshot-ignore]");
    if (btn) btn.style.display = "none";
    ignored.forEach((el) => (el.style.display = "none"));
    try {
      const isDark = document.documentElement.classList.contains("dark");
      const bgColor = isDark ? "#09090b" : "#ffffff";
      await new Promise((r) => setTimeout(r, 400));
      const canvas = await html2canvas(node, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        backgroundColor: bgColor,
        logging: false,
        removeContainer: true,
        imageTimeout: 5000,
      });
      if (btn) btn.style.display = "";
      ignored.forEach((el) => (el.style.display = ""));
      const storeName = selectedStore?.name ?? selectedStore?.id ?? "dashboard";
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const link = document.createElement("a");
      link.download = `DashboardV1-${storeName}-${dateStr}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err: unknown) {
      if (btn) btn.style.display = "";
      ignored.forEach((el) => (el.style.display = ""));
      console.error("Screenshot failed:", err);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, selectedStore, selectedDate]);

  // ── Loading / empty / error states ──────────────────────────────────────
  if (isLoading && !data) {
    return <DsprDashboardSkeleton />;
  }

  if (!selectedStore) {
    return (
      <Card className="border-2 border-dashed border-muted-foreground/25">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <div className="rounded-full bg-muted p-2.5">
            <Store className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-semibold">No Store Selected</h3>
            <p className="max-w-sm text-[11px] text-muted-foreground">
              Select a store from the sidebar to view its dashboard.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !data) {
    if (error.code === "FORBIDDEN") {
      return <ForbiddenWelcomeScreen />;
    }
    return (
      <Card className="border-2 border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <ShieldAlert className="h-7 w-7 text-destructive" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Couldn’t load the report</h3>
            <p className="max-w-md text-xs text-muted-foreground">{error.message}</p>
          </div>
          <Button size="sm" onClick={handleRefreshAll}>
            <RefreshCw className="me-1.5 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-2 border-dashed border-muted-foreground/25">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <CalendarIcon className="h-6 w-6 text-muted-foreground" />
          <p className="max-w-sm text-[11px] text-muted-foreground">
            No data available for this store. Select a date to load the report.
          </p>
          <Button size="sm" onClick={() => refetch(toApiDate(selectedDate))}>
            <RefreshCw className="me-1.5 h-4 w-4" />
            Load Report
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────
  const { filtering, sales, top, day, goal_metrics, store_score } = data;

  const weekLabel = `Week ${getISOWeek(parseISO(filtering.week_start))} (${format(parseISO(filtering.week_start), "MMM d")} → ${format(parseISO(filtering.week_end), "MMM d")})`;

  return (
    <div ref={dashboardRef} className={cn("space-y-2", isRefreshing && "relative")}>
      {isRefreshing && (
        <div className="absolute left-0 right-0 top-0 z-10" data-screenshot-ignore="true">
          <div className="h-0.5 overflow-hidden rounded-full bg-primary/30">
            <div className="h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-primary" />
          </div>
        </div>
      )}

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs font-medium">
          <Store className="h-3.5 w-3.5" />
          Store {selectedStore.storeId}
        </Badge>

        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 gap-1 text-xs font-medium">
              <CalendarIcon className="h-3 w-3" />
              {format(selectedDate, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => date > subDays(new Date(), 1)}
              defaultMonth={selectedDate}
            />
          </PopoverContent>
        </Popover>

        <Badge variant="outline" className="gap-1 px-2.5 py-1 text-xs">
          <CalendarIcon className="h-3 w-3" />
          Week {getISOWeek(parseISO(filtering.week_start))}
          <span className="text-muted-foreground">
            ({filtering.week_start} → {filtering.week_end})
          </span>
        </Badge>

        <div className="flex-1" />

        {error && data && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="destructive"
                className="cursor-pointer gap-1 text-xs"
                onClick={handleRefreshAll}
                role="button"
                tabIndex={0}
              >
                <AlertTriangle className="h-3 w-3" />
                Refresh failed — tap to retry
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{error.message}</TooltipContent>
          </Tooltip>
        )}

        <div className="flex items-center gap-1">
          {isStale && !isRefreshing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="cursor-pointer gap-1 border-amber-300 text-xs text-amber-600 dark:border-amber-800 dark:text-amber-400"
                  onClick={handleRefreshAll}
                  role="button"
                  tabIndex={0}
                >
                  <Clock className="h-3 w-3" />
                  Stale
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Data may be outdated. Click to refresh.</TooltipContent>
            </Tooltip>
          )}

          {lastUpdatedLabel && !isRefreshing && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {lastUpdatedLabel}
            </span>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleRefreshAll}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isRefreshing ? "Refreshing…" : "Refresh report"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-screenshot-btn
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleScreenshot}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isCapturing ? "Capturing…" : "Screenshot (Ultra HD)"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ── KPI hero ─────────────────────────────────────────────────────── */}
      <DaySummaryStats day={day} />

      {/* ── Store goals ribbon ───────────────────────────────────────────── */}
      {/* <StoreGoals sales={sales} day={day} goalMetrics={goal_metrics} /> */}

      {/* ── Sales & Trends ───────────────────────────────────────────────── */}
      <V1Section category="sales" weekLabel={weekLabel} gridClassName="gap-[7px]">
        <V1SalesTrendCard sales={sales} span={2} />
        <V1StoreScoreCard
          upsellingDay={day.upselling?.total_upselling_day}
          upsellingWeek={day.upselling?.total_upselling_week_to_date}
          goalMetrics={goal_metrics}
          storeScore={store_score}
          date={selectedDate}
          span={1}
        />
        <V1ChannelMixCard
          today={day.total_sales}
          weekly={day.total_sales_week_to_date_avg}
          span={1}
        />
        <V1CustomerSalesCard data={wbrData?.["customer-count-and-sales"]} isLoading={isLoading} span={1} />
        <V1PhoneSalesCard data={wbrData?.["phone-and-adjusted-sales"]} isLoading={isLoading} span={1} />
        <V1HourlyChannelsCard
          hourly={day.hourly_sales_and_channels}
          weekly={day.hourly_sales_and_channels_week_to_date_avg}
          span={2}
        />
        <V1OrdersVsSalesCard data={wbrData?.["orders-vs-sales"]} isLoading={isLoading} span={2} />
        <V1ChannelSalesWeeklyCard data={wbrData?.["channel-sales"]} isLoading={isLoading} span={2} />
      </V1Section>

      {/* ── Operations & Speed ───────────────────────────────────────────── */}
      <V1Section category="operations" weekLabel={weekLabel}>
        <V1PortalGaugeCard portal={day.portal} span={1} />
        <V1HnrCard hnr={day.hnr} weeklyHnr={day.hnr_week_to_date} span={1} />
        <V1LaborCard
          value={day.labor}
          weeklyValue={day.labor_week_to_date}
          weeklyAvgValue={day.labor_week_to_date_avg}
          weeklyLaborEntries={managerDashboard.weeklyLabor?.entries}
          span={1}
        />
        <V1GoToCard data={wbrData?.["go-to"]} isLoading={isLoading} span={1} />
        <V1PortalWeeklyCard data={wbrData?.["portal-weekly"]} isLoading={isLoading} span={2} />
        <V1NonNegotiableCard data={wbrData?.["non-negotiable-reports"]} isLoading={isLoading} span={2} />
      </V1Section>

      {/* ── Menu & Product ───────────────────────────────────────────────── */}
      <V1Section category="menu" weekLabel={weekLabel}>
        <V1TopItemsCard
          items={top.top_5_items_sales_for_day}
          weeklyItems={top.top_5_items_sales_week_to_date}
          countItems={top.top_5_items_count_for_day}
          weeklyCountItems={top.top_5_items_count_week_to_date}
          upselling={day.upselling}
          span={1}
        />
        <V1TopIngredientsCard
          mainIngredients={top?.ingredients?.main_5_ingredients_usage ?? []}
          paperIngredients={top?.ingredients?.top_paper_5_ingredients_usage ?? []}
          usedIngredients={top?.ingredients?.top_3_ingredients_used ?? []}
          highVarianceIngredients={top?.ingredients?.top_5_ingredients_variance_high}
          lowVarianceIngredients={top?.ingredients?.top_5_ingredients_variance_low}
          span={1}
        />
        <V1PromoCard data={wbrData?.promo} isLoading={isLoading} span={1} />
        <V1LtoCard data={wbrData?.lto} isLoading={isLoading} span={1} />
      </V1Section>

      {/* ── People & Labor ───────────────────────────────────────────────── */}
      <V1Section category="people" weekLabel={weekLabel}>
        <V1CurrentEmployeesCard managerDashboard={managerDashboard} span={2} />
        <V1HighHoursCard
          data={managerDashboard.highHoursEmployees}
          isLoading={managerDashboard.isLoading}
          span={2}
        />
        <V1BirthdayCard managerDashboard={managerDashboard} span={2} />
        <V1AveragePayCard
          data={managerDashboard.averageHourlyPay}
          isLoading={managerDashboard.isLoading}
          span={2}
        />
      </V1Section>

      {/* ── Finance & Cash ───────────────────────────────────────────────── */}
      <V1Section category="finance" weekLabel={weekLabel}>
        <V1CashControlCard data={wbrData?.["cash-control"]} isLoading={isLoading} span={1} />
        <V1TransferInOutCard
          data={wbrData?.["transfer-in-out"]}
          storeId={storeId}
          isLoading={isLoading}
          span={1}
        />
        <V1MoneyOwedCard data={hooksWbr.data?.money_owed} isLoading={hooksWbr.isLoading} span={2} />
      </V1Section>

      {/* ── Quality & Voice of Customer ──────────────────────────────────── */}
      <V1Section category="quality" weekLabel={weekLabel}>
        <V1QaRatingsCard
          requirements={[
            {
              service: "QA",
              method: "GET",
              path: "/audits/ratings-summary/overview",
              storeId: storeNumericId ? String(storeNumericId) : undefined,
            },
          ]}
          span={2}
        />
        <V1MaintenanceCard span={2} />
        <V1ComplaintsCard data={hooksWbr.data?.complaints} isLoading={hooksWbr.isLoading} span={2} />
        <V1FeedbacksCard data={hooksWbr.data?.feedbacks} isLoading={hooksWbr.isLoading} span={2} />
      </V1Section>
    </div>
  );
}
