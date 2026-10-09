"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { CalendarDays, LayoutDashboard, PenLine, RefreshCw, Sparkles, Store, Database, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useManagerHub } from "@/lib/hooks/use-manager-hub";
import { isIsoDate, todayIso, type EmployeeDebriefRange } from "@/lib/manager-hub/dates";
import { HubDetailDialog, type HubDetail } from "./detail-dialogs";
// KPI strip commented out on request (component kept in ./hub-kpis.tsx):
// import { HubKpis } from "./hub-kpis";
import { CountPill, HUB_ENTER, HubEmpty } from "./hub-ui";
import { MissingAlert } from "./missing-alert";
import { useHubSummary } from "./summary";
import { useHubActions } from "./use-hub-actions";
import { DebriefsTab } from "./tabs/debriefs-tab";
import { EmployeeDebriefsTab } from "./tabs/employee-debriefs-tab";
import { MISSED_SECTION_ID, OverviewTab } from "./tabs/overview-tab";
import { TasksTab } from "./tabs/tasks-tab";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Manager Hub — /dashboard/due-keys.                                       */
/*                                                                            */
/*  One place for a manager to see what they owe the store: cleaning-chart   */
/*  tasks and debriefs (with what's still missing, today and this week), and */
/*  the employee debriefs written lately. Read-only by design — every action */
/*  opens the floating debrief panel (its bubble is hidden on this page) or, */
/*  second, the full page on the same spot.                                  */
/*                                                                            */
/*  Naming (see the legacy page): "Due keys" in code = "Debrief" in the UI;  */
/*  "Debrief" in code = "Employee Debrief" in the UI.                        */
/* ────────────────────────────────────────────────────────────────────────── */

const TABS = ["overview", "tasks", "debriefs", "employee-debriefs"] as const;
export type HubTab = (typeof TABS)[number];

function isHubTab(value: string | null): value is HubTab {
  return value != null && (TABS as readonly string[]).includes(value);
}

export function ManagerHub() {
  return (
    <Suspense fallback={<HubSkeleton />}>
      <ManagerHubScreen />
    </Suspense>
  );
}

function HubSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** "Updated 2 minutes ago" — re-renders itself every 30s. */
function UpdatedAgo({ at, busy }: { at: number | null; busy: boolean }) {
  const t = useTranslations("managerHub");
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
  if (busy) return <span className="text-[11px] text-muted-foreground">{t("updating")}</span>;
  if (at == null) return null;
  return (
    <span className="text-[11px] text-muted-foreground">
      {t("updated", { time: formatDistanceToNow(at, { addSuffix: true }) })}
    </span>
  );
}

/**
 * The page's text direction, for Radix primitives: without a DirectionProvider
 * Radix Tabs stamps `dir="ltr"` on itself, which flips every row back to LTR
 * on the Arabic site even though <html dir="rtl">.
 */
function useDocumentDir(): "ltr" | "rtl" {
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");
  useEffect(() => {
    setDir(document.documentElement.dir === "rtl" ? "rtl" : "ltr");
  }, []);
  return dir;
}

function ManagerHubScreen() {
  const t = useTranslations("managerHub");
  const dir = useDocumentDir();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab");
  const requestedTab: HubTab = isHubTab(rawTab) ? rawTab : "overview";
  const rawDate = searchParams.get("date");
  const [realToday] = useState(todayIso);
  const anchor = isIsoDate(rawDate) ? rawDate : realToday;
  const isToday = anchor === realToday;

  const [employeeRange, setEmployeeRange] = useState<EmployeeDebriefRange>(7);
  const [detail, setDetail] = useState<HubDetail | null>(null);

  const data = useManagerHub(anchor, employeeRange);
  const summary = useHubSummary(data);
  const actions = useHubActions(data.storeCode);
  // A linked "tasks" tab falls back to the overview without cleaning access.
  const tab: HubTab = requestedTab === "tasks" && !data.canSeeCleaning ? "overview" : requestedTab;

  const replaceQuery = useCallback(
    (mutate: (q: URLSearchParams) => void) => {
      const q = new URLSearchParams(searchParams.toString());
      mutate(q);
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setTab = useCallback(
    (next: string) =>
      replaceQuery((q) => {
        if (next === "overview") q.delete("tab");
        else q.set("tab", next);
      }),
    [replaceQuery],
  );

  const setAnchor = (next: string) =>
    replaceQuery((q) => {
      if (!next || next === realToday) q.delete("date");
      else q.set("date", next);
    });

  const goMissed = () => {
    setTab("overview");
    // After the tab swap paints.
    setTimeout(() => {
      document.getElementById(MISSED_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const startFilling = () => {
    if (summary.tasksOverdue > 0) actions.openCleaning(anchor);
    else if (summary.debriefsMissing > 0) actions.openDebriefs(anchor);
    else actions.openCleaning(anchor);
  };

  const tabProps = { data, summary, actions, onDetail: setDetail, isToday, goTab: setTab };

  const tabBadge: Record<HubTab, { value: number; tone: "warn" | "bad" } | null> = {
    overview:
      summary.severity === "loading" || summary.today.length + summary.backlogCount === 0
        ? null
        : { value: summary.today.length + summary.backlogCount, tone: summary.severity === "overdue" ? "bad" : "warn" },
    tasks:
      data.canSeeCleaning && summary.tasksReady && summary.tasksOpen + summary.backlogTasks > 0
        ? { value: summary.tasksOpen + summary.backlogTasks, tone: summary.tasksOverdue + summary.backlogTasks > 0 ? "bad" : "warn" }
        : null,
    debriefs:
      summary.debriefsReady && summary.debriefsMissing + summary.backlogDebriefs > 0
        ? { value: summary.debriefsMissing + summary.backlogDebriefs, tone: summary.backlogDebriefs > 0 ? "bad" : "warn" }
        : null,
    "employee-debriefs": null,
  };

  const TAB_META: Record<HubTab, { icon: typeof Database; label: string }> = {
    overview: { icon: LayoutDashboard, label: t("tabs.overview") },
    tasks: { icon: Sparkles, label: t("tabs.tasks") },
    debriefs: { icon: Database, label: t("tabs.debriefs") },
    "employee-debriefs": { icon: PenLine, label: t("tabs.employeeDebriefs") },
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
          <span className="inline-flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-md border bg-card px-3 text-sm">
            <Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{data.storeName ?? t("noStore")}</span>
          </span>
          <DatePicker value={anchor} onChange={setAnchor} className="w-full sm:w-40" />
          {!isToday && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 animate-in fade-in-0" onClick={() => setAnchor(realToday)}>
              <Undo2 className="h-3.5 w-3.5" />
              {t("backToToday")}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={data.refreshAll}
            disabled={!data.storeCode || data.busy}
            aria-label={t("refresh")}
            title={t("refresh")}
          >
            <RefreshCw className={cn("h-4 w-4", data.busy && "animate-spin")} />
          </Button>
          <span className="hidden lg:inline">
            <UpdatedAgo at={data.updatedAt} busy={data.busy} />
          </span>
        </div>
      </PageHeader>

      {!data.storeCode ? (
        <div className="rounded-xl border bg-card">
          <HubEmpty icon={Store} title={t("noStoreTitle")} body={t("noStoreBody")} className="py-20" />
        </div>
      ) : (
        <>
          {!isToday && (
            <p className="-mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground animate-in fade-in-0">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {t("viewingPastDay")}
            </p>
          )}

          <MissingAlert
            summary={summary}
            isToday={isToday}
            anchor={anchor}
            canSeeCleaning={data.canSeeCleaning}
            onStart={startFilling}
            onReviewMissed={goMissed}
            onGoTasks={() => setTab("tasks")}
            onGoDebriefs={() => setTab("debriefs")}
          />

          {/* KPI strip (Debriefs filled / Cleaning done / Missed · 7 days / Employee
              debriefs) — commented out on request; the component is kept in
              ./hub-kpis.tsx so it can come back.
          <HubKpis
            summary={summary}
            canSeeCleaning={data.canSeeCleaning}
            employeeRangeDays={employeeRange}
            onGo={(target) => (target === "missed" ? goMissed() : setTab(target))}
          />
          */}

          <Tabs value={tab} onValueChange={setTab} dir={dir} className="w-full">
            <div className="-mx-1 overflow-x-auto px-1">
              <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
                {TABS.filter((id) => id !== "tasks" || data.canSeeCleaning).map((id) => {
                  const meta = TAB_META[id];
                  const badge = tabBadge[id];
                  return (
                    <TabsTrigger key={id} value={id} className="gap-1.5 whitespace-nowrap">
                      <meta.icon className="h-4 w-4" />
                      <span>{meta.label}</span>
                      {badge && <CountPill value={badge.value} tone={badge.tone} />}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <TabsContent value="overview" className={cn("mt-4", HUB_ENTER)}>
              {tab === "overview" && <OverviewTab {...tabProps} />}
            </TabsContent>
            {data.canSeeCleaning && (
              <TabsContent value="tasks" className={cn("mt-4", HUB_ENTER)}>
                {tab === "tasks" && <TasksTab {...tabProps} />}
              </TabsContent>
            )}
            <TabsContent value="debriefs" className={cn("mt-4", HUB_ENTER)}>
              {tab === "debriefs" && <DebriefsTab {...tabProps} />}
            </TabsContent>
            <TabsContent value="employee-debriefs" className={cn("mt-4", HUB_ENTER)}>
              {tab === "employee-debriefs" && (
                <EmployeeDebriefsTab {...tabProps} range={employeeRange} onRangeChange={setEmployeeRange} />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <HubDetailDialog
        detail={detail}
        onClose={() => setDetail(null)}
        actions={actions}
        storeCode={data.storeCode}
      />
    </div>
  );
}
