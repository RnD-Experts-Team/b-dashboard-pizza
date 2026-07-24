"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { format, subDays, formatDistanceToNow, getISOWeek, parseISO } from "date-fns";
import html2canvas from "html2canvas-pro";
import { useWbrCard } from "@/lib/hooks/use-wbr-card";
import { useManagerDashboard } from "@/lib/hooks/use-manager-dashboard";
import { useHooksWbr } from "@/lib/hooks/use-hooks-wbr";
import {
  SalesChart,
  TopItemsList,
  TopIngredientsList,
  HourlyChannelsChart,
  DailySalesByChannelChart,
  DaySummaryStats,
  HnrCard,
  PortalOnTimeDualGauge,
  StoreScoreCard,
  LaborGauge,
  SalesHistoryCard,
  DsprDashboardSkeleton,
  RecentMaintenanceTable,
  CurrentEmployeesTable,
  TopQaRatingsCard,
  EmployeeBirthday,
  TopEmployeeHours,
  StoreGoals,
  WbrCustomerSalesCard,
  WbrChannelSalesCard,
  WbrPromoCard,
  WbrPortalWeeklyCard,
  WbrCashControlCard,
  WbrPhoneSalesCard,
  WbrNonNegotiableCard,
  WbrLtoCard,
  WbrGoToCard,
  WbrHighHoursCard,
  WbrAveragePayCard,
  WbrComplaintsCard,
  WbrFeedbacksCard,
  WbrMoneyOwedCard,
  WbrOrdersVsSalesCard,
  WbrTransferInOutCard,
  WbrCleaningReviewCard,
  WbrCustomerServiceCard,
} from "@/components/dspr";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  RefreshCw,
  Store,
  Pizza,
  Calendar as CalendarIcon,
  ExternalLink,
  Clock,
  WifiOff,
  ShieldAlert,
  SearchX,
  ServerCrash,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Eye,
  EyeOff,
  HelpCircle,
  ImageDown,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageGuide } from "@/components/shared/page-guide";
import { DSPR_GUIDE_STEPS } from "./dspr-guide-config";
import { buildDsprReportHtml } from "./dspr-report-template";

/** Format a Date to YYYY-MM-DD (API-compatible format) */
function toApiDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error state component                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function ErrorDisplay({
  error,
  onRetry,
  onClear,
  locale,
}: {
  error: {
    message: string;
    code: string;
    retryable: boolean;
    retryAfter?: number;
  };
  onRetry: () => void;
  onClear: () => void;
  locale: string;
}) {
  const errorConfig = useMemo(() => {
    switch (error.code) {
      case "NOT_AUTHENTICATED":
        return {
          icon: ShieldAlert,
          title: "Authentication Required",
          color: "text-amber-500",
          borderColor: "border-amber-200 dark:border-amber-900/50",
          bgColor: "bg-amber-50/50 dark:bg-amber-950/20",
        };
      case "UNAUTHORIZED":
        return {
          icon: ShieldAlert,
          title: "DSPR Access Issue",
          color: "text-amber-500",
          borderColor: "border-amber-200 dark:border-amber-900/50",
          bgColor: "bg-amber-50/50 dark:bg-amber-950/20",
        };
      case "FORBIDDEN":
        return {
          icon: ShieldAlert,
          title: "Access Denied",
          color: "text-red-500",
          borderColor: "border-red-200 dark:border-red-900/50",
          bgColor: "bg-red-50/50 dark:bg-red-950/20",
        };
      case "NOT_FOUND":
        return {
          icon: SearchX,
          title: "No Report Data",
          color: "text-slate-500",
          borderColor: "border-slate-200 dark:border-slate-800",
          bgColor: "bg-slate-50/50 dark:bg-slate-950/20",
        };
      case "TIMEOUT":
      case "NETWORK_ERROR":
        return {
          icon: WifiOff,
          title: "Connection Issue",
          color: "text-orange-500",
          borderColor: "border-orange-200 dark:border-orange-900/50",
          bgColor: "bg-orange-50/50 dark:bg-orange-950/20",
        };
      case "RATE_LIMITED":
        return {
          icon: Clock,
          title: "Rate Limited",
          color: "text-blue-500",
          borderColor: "border-blue-200 dark:border-blue-900/50",
          bgColor: "bg-blue-50/50 dark:bg-blue-950/20",
        };
      case "SERVER_ERROR":
        return {
          icon: ServerCrash,
          title: "Server Error",
          color: "text-red-500",
          borderColor: "border-red-200 dark:border-red-900/50",
          bgColor: "bg-red-50/50 dark:bg-red-950/20",
        };
      default:
        return {
          icon: AlertCircle,
          title: "Something Went Wrong",
          color: "text-destructive",
          borderColor: "border-destructive/30",
          bgColor: "bg-destructive/5",
        };
    }
  }, [error.code]);

  const Icon = errorConfig.icon;

  return (
    <Card
      className={cn("border-2", errorConfig.borderColor, errorConfig.bgColor)}
    >
      <CardContent className="flex flex-col items-center justify-center py-6 text-center gap-2">
        <div className={cn("rounded-full p-2.5", errorConfig.bgColor)}>
          <Icon className={cn("h-6 w-6", errorConfig.color)} />
        </div>

        <div className="space-y-1 max-w-md">
          <h3 className="text-xs font-semibold">{errorConfig.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {error.message}
          </p>
          {error.retryAfter && (
            <p className="text-xs text-muted-foreground">
              Try again in {error.retryAfter} seconds
            </p>
          )}
        </div>

        <div className="flex gap-3">
          {error.code === "NOT_AUTHENTICATED" ? (
            <Button variant="default" size="sm" asChild>
              <a href={`/${locale}/auth/login`}>
                <ShieldAlert className="h-4 w-4 me-1.5" />
                Log In
              </a>
            </Button>
          ) : error.retryable ? (
            <Button variant="default" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 me-1.5" />
              Try Again
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onClear}>
              Dismiss
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <a
              href="https://tasks.rdexperts.tech/support-ticket"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 me-1.5" />
              Support
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ForbiddenWelcomeScreen({ locale }: { locale: string }) {
  return (
    <Card className="overflow-hidden border  ">
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
            <br />
            Enjoy exploring the dashboard.
          </p>

          <div className="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {/* <Button asChild className="w-full sm:w-auto">
              <a href={`/${locale}/dashboard`}>
                <Store className="me-2 h-4 w-4" />
                Open Dashboard
              </a>
            </Button> */}
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

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main Dashboard                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Full DSPR Dashboard — production-ready with:
 *  - Structured error display per error code
 *  - Smart refresh with stale indicator
 *  - Background refresh indicator
 *  - Last-updated timestamp
 *  - Smooth loading transitions
 */
interface DsprDashboardProps {
  /** Controlled date — pass this + onSelectedDateChange to sync the date across multiple mounted dashboard UIs (e.g. the main/V1 toggle). Uncontrolled (defaults to yesterday) when omitted. */
  selectedDate?: Date;
  onSelectedDateChange?: (date: Date) => void;
}

export function DsprDashboard({
  selectedDate: controlledDate,
  onSelectedDateChange,
}: DsprDashboardProps = {}) {
  const {
    data,
    wbrData,
    isLoading,
    isRefreshing,
    error,
    lastFetchedAt,
    refetch,
    refresh,
    clearError,
    isStale,
    selectedStore,
  } = useWbrCard();

  const params = useParams();
  const locale = (params?.locale as string) || "en";

  // Default date = yesterday
  const [internalDate, setInternalDate] = useState<Date>(
    subDays(new Date(), 1),
  );
  const selectedDate = controlledDate ?? internalDate;
  const setSelectedDate = onSelectedDateChange ?? setInternalDate;
  const [dateOpen, setDateOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Re-fetch when date changes
  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      setSelectedDate(date);
      setDateOpen(false);
      refetch(toApiDate(date));
    },
    [refetch, setSelectedDate],
  );

  // Re-fetch when the selected store changes
  // Use the human-readable storeId (e.g. "03795-00021") — this is what the DSPR API expects
  const storeId = selectedStore?.storeId ?? selectedStore?.id ?? null;
  // Numeric id used as the storePermissions map key for canAccessRoute checks
  const storeNumericId = selectedStore?.id ?? null;
  // console.log("[DsprDashboard] render:", { storeId, selectedStore: selectedStore ? { id: selectedStore.id, name: selectedStore.name } : null, hasData: !!data, isLoading, error });
  const selectedDateRef = useRef(selectedDate);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    if (storeId) {
      refetch(toApiDate(selectedDateRef.current));
    }
  }, [storeId, refetch]);

  // Manager dashboard — shared fetch for employee cards
  const managerDashboard = useManagerDashboard(
    storeId,
    toApiDate(selectedDate),
  );

  // Hooks WBR — complaints, feedbacks, money_owed for the week
  const hooksWbr = useHooksWbr(storeId, toApiDate(selectedDate));

  // Format "last updated" time
  const lastUpdatedLabel = useMemo(() => {
    if (!lastFetchedAt) return null;
    return formatDistanceToNow(lastFetchedAt, { addSuffix: true });
  }, [lastFetchedAt]);

  // Guide steps — drop the Store Goals step when there are no non-upselling goals.
  // goal_metrics is an array; an empty array or one containing only "Upselling"
  // entries means the StoreGoals ribbon won't show anything meaningful.
  const guideSteps = useMemo(() => {
    const hasGoals =
      Array.isArray(data?.goal_metrics) &&
      data.goal_metrics.some(
        (m: { metric_name: string }) => m.metric_name !== "Upselling",
      );
    if (hasGoals) return DSPR_GUIDE_STEPS;
    return DSPR_GUIDE_STEPS.filter((s) => s.id !== "dspr-goals");
  }, [data?.goal_metrics]);

  // ── Screenshot ref & handler ───────────────────────────────────────────
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCapturingReport, setIsCapturingReport] = useState(false);

  // Toggle to remove section backgrounds (persisted in localStorage)
  const [hideSectionBackgrounds, setHideSectionBackgrounds] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("dspr.hideSectionBackgrounds");
      if (v !== null) setHideSectionBackgrounds(JSON.parse(v));
    } catch (err) {
      // ignore
    }
  }, []);

  const handleScreenshot = useCallback(async () => {
    if (!dashboardRef.current || isCapturing) return;
    setIsCapturing(true);

    const node = dashboardRef.current;

    // Hide the screenshot button & refresh shimmer during capture
    const btn = node.querySelector<HTMLElement>("[data-screenshot-btn]");
    const ignored = node.querySelectorAll<HTMLElement>(
      "[data-screenshot-ignore]",
    );
    if (btn) btn.style.display = "none";
    ignored.forEach((el) => (el.style.display = "none"));

    try {
      // Resolve the background color
      const isDark = document.documentElement.classList.contains("dark");
      const bgColor = isDark ? "#09090b" : "#ffffff";

      // Wait for animations / chart reflows to settle
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

      // Restore hidden elements .
      if (btn) btn.style.display = "";
      ignored.forEach((el) => (el.style.display = ""));

      // Download the image
      const storeName = selectedStore?.name ?? selectedStore?.id ?? "dashboard";
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const link = document.createElement("a");
      link.download = `DSPR-${storeName}-${dateStr}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err: unknown) {
      // Restore hidden elements on failure
      if (btn) btn.style.display = "";
      ignored.forEach((el) => (el.style.display = ""));

      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err);
      console.error("Screenshot failed:", message, err);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, selectedStore, selectedDate]);

  // ── Screenshot the printable "Focus on the Five" HTML report as a PNG ───
  // Renders the report off-screen in a hidden iframe (so its own fonts/CSS
  // apply), waits for it to finish loading, then captures it with the same
  // html2canvas approach as the live dashboard screenshot.
  const handleScreenshotReport = useCallback(async () => {
    if (!data || isCapturingReport) return;
    setIsCapturingReport(true);

    const html = buildDsprReportHtml(data, selectedDate);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "0";
    iframe.style.left = "-99999px";
    iframe.style.width = "1180px";
    iframe.style.height = "2000px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    try {
      await new Promise<void>((resolve, reject) => {
        iframe.onload = () => resolve();
        iframe.onerror = () => reject(new Error("Failed to render report"));
        iframe.srcdoc = html;
      });

      const doc = iframe.contentDocument;
      const dashboardEl = doc?.querySelector<HTMLElement>(".dashboard");
      if (!doc || !dashboardEl) throw new Error("Report content did not render");

      // Wait for web fonts + Font Awesome icons to finish loading.
      try {
        await doc.fonts?.ready;
      } catch {
        // ignore — fall through to the fixed delay below
      }
      await new Promise((r) => setTimeout(r, 600));

      // Resize the iframe to the report's actual rendered height before capture.
      iframe.style.height = `${dashboardEl.scrollHeight}px`;
      await new Promise((r) => setTimeout(r, 50));

      const canvas = await html2canvas(dashboardEl, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#efefef",
        logging: false,
        imageTimeout: 8000,
      });

      const storeName = selectedStore?.storeId ?? selectedStore?.id ?? "store";
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const link = document.createElement("a");
      link.download = `DSPR-Report-${storeName}-${dateStr}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Report screenshot failed:", err);
    } finally {
      document.body.removeChild(iframe);
      setIsCapturingReport(false);
    }
  }, [data, isCapturingReport, selectedDate, selectedStore]);

  const toggleHideBackgrounds = useCallback(() => {
    setHideSectionBackgrounds((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          "dspr.hideSectionBackgrounds",
          JSON.stringify(next),
        );
      } catch (err) {
        // ignore
      }
      return next;
    });
  }, []);

  // ── Initial loading (no data yet) ──────────────────────────────────────
  if (isLoading && !data) {
    return <DsprDashboardSkeleton />;
  }

  // ── No store selected ─────────────────────────────────────────────────
  if (!selectedStore) {
    return (
      <Card className="border-2 border-dashed border-muted-foreground/25">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <div className="rounded-full bg-muted p-2.5">
            <Store className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-semibold">No Store Selected</h3>
            <p className="text-[11px] text-muted-foreground max-w-sm">
              Select a store from the sidebar to view its Daily Store
              Performance Report.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Error state (no data) ──────────────────────────────────────────────
  if (error && !data) {
    if (error.code === "FORBIDDEN") {
      return <ForbiddenWelcomeScreen locale={locale} />;
    }

    return (
      <ErrorDisplay
        error={error}
        onRetry={() => refetch(toApiDate(selectedDate))}
        onClear={clearError}
        locale={locale}
      />
    );
  }

  // ── No data & no error ─────────────────────────────────────────────────
  if (!data) {
    return (
      <Card className="border-2 border-dashed border-muted-foreground/25">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <div className="rounded-full bg-muted p-2.5">
            <CalendarIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-semibold">No Report Data</h3>
            <p className="text-[11px] text-muted-foreground max-w-sm">
              No data is available for this store. Select a date to load the
              report.
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => refetch(toApiDate(selectedDate))}
          >
            <RefreshCw className="h-4 w-4 me-1.5" />
            Load Report
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Success: render dashboard ──────────────────────────────────────────
  const { filtering, sales, top, day, goal_metrics, store_score } = data;

  return (
    <div
      ref={dashboardRef}
      className={cn(
        "space-y-1",
        isRefreshing && "relative",
        hideSectionBackgrounds && "no-section-backgrounds",
      )}
    >
      {/* ── Refresh overlay bar ──────────────────────────────────── */}
      {isRefreshing && (
        <div
          className="absolute top-0 left-0 right-0 z-10"
          data-screenshot-ignore="true"
        >
          <div className="h-0.5 bg-primary/30 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-primary rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
        </div>
      )}

      {/* ── Header bar ───────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-1"
        data-guide-id="dspr-header"
      >
        {/* Store badge */}
        <Badge
          variant="secondary"
          className="text-xs gap-1.5 px-3 py-1 font-medium"
        >
          <Store className="h-3.5 w-3.5" />
          Store {selectedStore.storeId}
        </Badge>

        {/* Date picker */}
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-6 gap-1 text-xs font-medium",
                !selectedDate && "text-muted-foreground",
              )}
            >
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

        {/* Week badge — use week_start date for the number since the fiscal week
            starts Tuesday; iso_week reflects the Monday end date which is +1 */}
        <Badge variant="outline" className="text-xs gap-1 px-2.5 py-1">
          <CalendarIcon className="h-3 w-3" />
          Week {getISOWeek(parseISO(filtering.week_start))}
          <span className="text-muted-foreground">
            ({filtering.week_start} → {filtering.week_end})
          </span>
        </Badge>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Error banner inline (when we have data but also an error from refresh) */}
        {error && data && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="destructive"
                className="text-xs gap-1 cursor-pointer animate-in fade-in"
                onClick={() => refetch(toApiDate(selectedDate))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    refetch(toApiDate(selectedDate));
                  }
                }}
              >
                <AlertTriangle className="h-3 w-3" />
                Refresh failed — tap to retry
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{error.message}</TooltipContent>
          </Tooltip>
        )}

        {/* Status indicators */}
        <div className="flex items-center gap-1">
          {/* Stale indicator */}
          {isStale && !isRefreshing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-xs gap-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 cursor-pointer"
                  onClick={refresh}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      refresh();
                    }
                  }}
                >
                  <Clock className="h-3 w-3" />
                  Stale
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Data may be outdated. Click to refresh.
              </TooltipContent>
            </Tooltip>
          )}

          {/* Last updated */}
          {lastUpdatedLabel && !isRefreshing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  {lastUpdatedLabel}
                </span>
              </TooltipTrigger>
              <TooltipContent>Last updated {lastUpdatedLabel}</TooltipContent>
            </Tooltip>
          )}

          {/* Refresh button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => refetch(toApiDate(selectedDate))}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isRefreshing ? "Refreshing…" : "Refresh report"}
            </TooltipContent>
          </Tooltip>

          {/* Screenshot / Download report / Toggle section backgrounds */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                data-screenshot-btn
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Export & view options"
              >
                {isCapturing || isCapturingReport ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <MoreVertical className="h-3 w-3" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleScreenshot} disabled={isCapturing}>
                <Camera className="h-3.5 w-3.5 me-2" />
                {isCapturing ? "Capturing…" : "Screenshot (Ultra HD)"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleScreenshotReport} disabled={!data || isCapturingReport}>
                <ImageDown className="h-3.5 w-3.5 me-2" />
                {isCapturingReport ? "Capturing…" : "Report screenshot (PNG)"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={toggleHideBackgrounds}>
                {hideSectionBackgrounds ? (
                  <Eye className="h-3.5 w-3.5 me-2" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 me-2" />
                )}
                {hideSectionBackgrounds ? "Show section backgrounds" : "Hide section backgrounds"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Page guide button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setGuideOpen(true)}
                aria-label="Open page guide"
              >
                <HelpCircle className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Page guide</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ── Store goals ribbon ────────────────────────────────────── */}
      {/* <div data-guide-id="dspr-goals">
        <StoreGoals sales={sales} day={day} goalMetrics={goal_metrics} />
      </div> */}

      {/* ── Day summary stats ribbon ────────────────────────────── */}
      <div data-guide-id="dspr-summary">
        <DaySummaryStats day={day} />
      </div>

      {/* ── Weekly Sales + Portal gauges ─────────────────────────── */}
      <div
        className="grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-4"
        data-guide-id="dspr-sales"
      >
        <SalesChart
          sales={sales}
          height={190}
          toolbar={false}
          laborWeekToDateByDay={day.labor_week_to_date_by_day}
          className="md:col-span-2 lg:col-span-2"
        />
        {/* <div className="flex flex-row lg:col-span-2 rounded-xl border shadow-sm gap-0 overflow-hidden "> */}
        <StoreScoreCard
          upsellingDay={day.upselling?.total_upselling_day}
          upsellingWeek={day.upselling?.total_upselling_week_to_date}
          goalMetrics={goal_metrics}
          storeScore={store_score}
          date={selectedDate}
          className="lg:col-span-1"
        />
        <PortalOnTimeDualGauge portal={day.portal} className="lg:col-span-1" />
        {/* </div> */}
      </div>

      {/* ── HNR · Labor · Top 5 Menu Items ───────────────────────── */}
      {/* <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3"> */}
      <div
        className="grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-4"
        data-guide-id="dspr-channels"
      >
        {/* <LaborGauge value={day.labor} /> */}

        <HourlyChannelsChart
          hourlyData={day.hourly_sales_and_channels}
          weeklyData={day.hourly_sales_and_channels_week_to_date_avg}
          height={190}
          toolbar={false}
          className="md:col-span-2 lg:col-span-1"
        />
        <DailySalesByChannelChart
          totalSales={day.total_sales}
          weeklyTotalSales={day.total_sales_week_to_date_avg}
          height={200}
          toolbar={false}
          className="md:col-span-2 lg:col-span-1"
        />
        <HnrCard hnr={day.hnr} weeklyHnr={day.hnr_week_to_date} weeklyAvgHnr={day.hnr_week_to_date_avg} />
        <LaborGauge
          value={day.labor}
          weeklyValue={day.labor_week_to_date}
          weeklyAvgValue={day.labor_week_to_date_avg}
          weeklyLaborEntries={managerDashboard.weeklyLabor?.entries}
          laborWeekToDateByDay={day.labor_week_to_date_by_day}
        />
      </div>

      {/* ── Sales History ─────────────────────────────────────────── */}
      <div data-guide-id="dspr-sales-history">
        <SalesHistoryCard data={wbrData?.["sales-history"]} isLoading={isLoading} />
      </div>

      {/* ── Hourly + Daily Channel Sales ────────────────────────── */}
      <div
        className="grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-4"
        data-guide-id="dspr-top-lists"
      >
        <TopItemsList
          items={top.top_5_items_sales_for_day}
          weeklyItems={top.top_5_items_sales_week_to_date}
          countItems={top.top_5_items_count_for_day}
          weeklyCountItems={top.top_5_items_count_week_to_date}
          upselling={day.upselling}
          className="sm:col-span-2 lg:col-span-1"
        />
        <TopIngredientsList
          mainIngredients={top?.ingredients?.main_5_ingredients_usage ?? []}
          paperIngredients={
            top?.ingredients?.top_paper_5_ingredients_usage ?? []
          }
          usedIngredients={top?.ingredients?.top_3_ingredients_used ?? []}
          highVarianceIngredients={
            top?.ingredients?.top_5_ingredients_variance_high
          }
          lowVarianceIngredients={
            top?.ingredients?.top_5_ingredients_variance_low
          }
          className="sm:col-span-2 lg:col-span-1"
        />
        <RecentMaintenanceTable />
        <TopQaRatingsCard
          requirements={[
            {
              service: "QA",
              method: "GET",
              path: "/audits/ratings-summary/overview",
              storeId: storeNumericId ? String(storeNumericId) : undefined,
            },
          ]}
        />
      </div>

      {/* ── Current Employees + Birthday + Top Hours ──────────────── */}
      <div
        className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4"
        data-screenshot-ignore="true"
        data-guide-id="dspr-employees"
      >
        <CurrentEmployeesTable
          requirements={[
            {
              service: "Hiring",
              method: "GET",
              path: "/v1/stores/*/employees",
              storeId: storeNumericId ? String(storeNumericId) : undefined,
            },
            {
              service: "Hiring",
              method: "GET",
              path: "/v1/stores/*/manager-dashboard/*",
              storeId: storeNumericId ? String(storeNumericId) : undefined,
            },
          ]}
          managerDashboard={managerDashboard}
          className="sm:col-span-3 lg:col-span-3"
        />
        <EmployeeBirthday
          requirements={[
            {
              service: "Hiring",
              method: "GET",
              path: "/v1/stores/*/manager-dashboard/*",
              storeId: storeNumericId ? String(storeNumericId) : undefined,
            },
          ]}
          managerDashboard={managerDashboard}
          className="lg:col-span-1"
        />
        {/* <TopEmployeeHours
          requirements={[
            {
              service: "Hiring",
              method: "GET",
              path: "/v1/stores/*
              /manager-dashboard/*",
              storeId: storeNumericId ? String(storeNumericId) : undefined,
            },
          ]}
          managerDashboard={managerDashboard}
          className="lg:col-span-1"
        /> */}
      </div>

      {/* ── WBR Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <WbrCustomerSalesCard data={wbrData?.["customer-count-and-sales"]} isLoading={isLoading} />
        </div>

        <div>
          <WbrPhoneSalesCard data={wbrData?.["phone-and-adjusted-sales"]} isLoading={isLoading} />
        </div>

        <div>
          <WbrChannelSalesCard data={wbrData?.["channel-sales"]} isLoading={isLoading} />
        </div>

        <div>
          <WbrCashControlCard data={wbrData?.["cash-control"]} isLoading={isLoading} />
        </div>

        <div>
          <WbrPromoCard data={wbrData?.promo} isLoading={isLoading} />
        </div>

        <div>
          <WbrLtoCard data={wbrData?.lto} isLoading={isLoading} />
        </div>

        <div>
          <WbrPortalWeeklyCard data={wbrData?.["portal-weekly"]} isLoading={isLoading} />
        </div>

        <div>
          <WbrGoToCard data={wbrData?.["go-to"]} isLoading={isLoading} />
        </div>

        <div className="md:col-span-2 lg:col-span-2" data-screenshot-ignore="true">
          <WbrHighHoursCard data={managerDashboard.highHoursEmployees} isLoading={managerDashboard.isLoading} />
        </div>

        <div>
          <WbrOrdersVsSalesCard data={wbrData?.["orders-vs-sales"]} isLoading={isLoading} />
        </div>

        <div data-screenshot-ignore="true">
          <WbrTransferInOutCard data={wbrData?.["transfer-in-out"]} storeId={storeId} isLoading={isLoading} />
        </div>

        <div className="md:col-span-2 lg:col-span-2">
          <WbrNonNegotiableCard data={wbrData?.["non-negotiable-reports"]} isLoading={isLoading} />
        </div>

        <div data-screenshot-ignore="true">
          <WbrComplaintsCard data={hooksWbr.data?.complaints} isLoading={hooksWbr.isLoading} />
        </div>

        <div data-screenshot-ignore="true">
          <WbrFeedbacksCard data={hooksWbr.data?.feedbacks} isLoading={hooksWbr.isLoading} />
        </div>

        <div className="md:col-span-2 lg:col-span-1" data-screenshot-ignore="true">
          <WbrMoneyOwedCard data={hooksWbr.data?.money_owed} isLoading={hooksWbr.isLoading} />
        </div>

        <div>
          <WbrAveragePayCard data={managerDashboard.averageHourlyPay} isLoading={managerDashboard.isLoading} />
        </div>

        <div>
          <WbrCustomerServiceCard data={wbrData?.["customer-service"]} isLoading={isLoading} />
        </div>
        
        <div>
          <WbrCleaningReviewCard data={wbrData?.["cleaning-review"]} isLoading={isLoading} />
        </div>
      </div>
      <PageGuide
        steps={guideSteps}
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
      />
    </div>
  );
}
