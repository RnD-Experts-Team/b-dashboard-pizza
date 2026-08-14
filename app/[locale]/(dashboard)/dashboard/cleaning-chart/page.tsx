"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CalendarDays,
  ClipboardList,
  Grid3x3,
  FileBarChart,
  Lock,
  Plus,
  RefreshCw,
  Store,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useCleaningTasks, useCleaningEvaluation, todayIso } from "@/lib/hooks/use-cleaning";
import { useCleaningStore } from "@/lib/store/cleaning.store";
import { useCleaningActionStore } from "@/lib/store/cleaning-action.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import { canAccessCleaningTab, canEvaluateCleaning, type CleaningTabId } from "@/lib/auth/cleaning-access";
import { cleaningService, CleaningError } from "@/lib/api/services/cleaning.service";
import { currentPeriodKey } from "@/lib/cleaning/period-options";
import type { ChartVerdict, EvaluationGrid as Grid, DueStatus, PeriodType } from "@/types/cleaning.types";
import {
  DueList,
  TasksList,
  CreateTaskDialog,
  EvaluationGrid,
  ReportsView,
  MyStoreResults,
  CleaningErrorState,
  StorePicker,
  PeriodPicker,
  DueSkeleton,
  TasksSkeleton,
  EvaluationSkeleton,
  ReportsSkeleton,
  type StoreOption,
} from "@/components/cleaning";

const TAB_DEFS: { id: CleaningTabId; labelKey: string; icon: LucideIcon; render: () => React.ReactNode }[] = [
  { id: "due", labelKey: "due", icon: CalendarDays, render: () => <DueTab /> },
  { id: "tasks", labelKey: "tasks", icon: ClipboardList, render: () => <TasksTab /> },
  { id: "evaluation", labelKey: "evaluation", icon: Grid3x3, render: () => <EvaluationTab /> },
  { id: "reports", labelKey: "reports", icon: FileBarChart, render: () => <ReportsTab /> },
  { id: "my-store", labelKey: "myStore", icon: Store, render: () => <MyStoreResults /> },
];

export default function CleaningChartPage() {
  const t = useTranslations("cleaningChart");
  const { selectedStore } = useSelectedStoreStore();
  const { overviewStores, canAccessRoute, hasAnyRole } = useAuthStore();
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;

  const visibleTabs = useMemo(
    () =>
      TAB_DEFS.filter((tab) =>
        canAccessCleaningTab(tab.id, { canAccessRoute, hasAnyRole }, effectiveStoreId)
      ),
    [canAccessRoute, hasAnyRole, effectiveStoreId]
  );

  const [activeTab, setActiveTab] = useState<CleaningTabId>("due");

  // If the active tab becomes hidden (e.g. permissions load after mount, or the
  // selected store changes what's scoped-accessible), fall back to the first
  // tab the user can actually see.
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  // A "cleaning_evaluation_ready" notification click lands here — jump straight
  // to My Store with the exact period the notification is about, instead of
  // whatever period happens to be current.
  const pendingCleaningAction = useCleaningActionStore((s) => s.pendingCleaningAction);
  const clearPendingCleaningAction = useCleaningActionStore((s) => s.clearPendingCleaningAction);
  const fetchGrid = useCleaningStore((s) => s.fetchGrid);
  useEffect(() => {
    if (!pendingCleaningAction) return;
    if (visibleTabs.some((tab) => tab.id === "my-store")) {
      setActiveTab("my-store");
      void fetchGrid(pendingCleaningAction.periodType, pendingCleaningAction.periodKey);
    }
    clearPendingCleaningAction();
  }, [pendingCleaningAction, visibleTabs, fetchGrid, clearPendingCleaningAction]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("page.title")} description={t("page.description")} />

      {visibleTabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("page.noAccessTitle")}</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {t("page.noAccessDescription")}
            </p>
          </div>
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as CleaningTabId)}
          className="w-full"
        >
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
              {visibleTabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="gap-2 whitespace-nowrap">
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t(`tabs.${tab.labelKey}`)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {visibleTabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-4">
              {tab.render()}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

/* ── Due Today ── */
function DueTab() {
  const t = useTranslations("cleaningChart");
  // Same store list the sidebar's own switcher uses (overviewStores, loaded once
  // at login from /auth/general-overview) — already scoped to whatever stores
  // THIS user can access (e.g. a store manager's 2 assigned stores), unlike
  // storeService.getStores() which lists every company store regardless of role.
  const { overviewStores, canAccessRoute } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();
  const {
    dueData,
    dueLoading,
    dueError,
    fetchDue,
    completeTask,
    uncompleteTask,
    setChartCell,
  } = useCleaningStore();

  const [store, setStore] = useState<StoreOption | null>(null);
  const [date, setDate] = useState<string>(todayIso());
  const [status, setStatus] = useState<"all" | DueStatus>("all");

  // Cleaning-specialist only. setChartCell reads the current evaluation
  // period from the same shared store the Evaluation tab uses, so a Due-page
  // toggle lands in the same grid the specialist is already grading.
  const canEvaluate = canEvaluateCleaning(
    { canAccessRoute },
    store ? String(store.id) : undefined
  );

  // Cross-reference the evaluation grid (same shared period as the Evaluation
  // tab) so a task that's already been graded this period shows it — without
  // this, evaluating from Due gave no lasting sign it had taken effect.
  const { grid: evalGrid } = useCleaningEvaluation();
  const evaluatedVerdicts = useMemo(() => {
    const map: Record<number, ChartVerdict> = {};
    const row = store ? evalGrid?.rows.find((r) => r.storeId === store.id) : null;
    if (!row) return map;
    for (const cells of Object.values(row.chart)) {
      for (const cell of cells) {
        if (cell.verdict) map[cell.taskId] = cell.verdict;
      }
    }
    return map;
  }, [evalGrid, store]);

  const options: StoreOption[] = useMemo(
    () =>
      (overviewStores ?? []).map((s) => ({
        id: Number(s.id),
        code: s.storeId ?? s.id,
        name: s.name,
      })),
    [overviewStores]
  );

  const allItems = dueData?.items ?? [];
  const counts = useMemo(() => {
    const c = { all: allItems.length, pending: 0, done: 0, overdue: 0 };
    for (const it of allItems) c[it.status]++;
    return c;
  }, [allItems]);
  const visibleItems = useMemo(
    () => (status === "all" ? allItems : allItems.filter((i) => i.status === status)),
    [allItems, status]
  );

  // Default to the globally-selected store, else the first store in the list.
  useEffect(() => {
    if (store) return;
    if (selectedStore) {
      setStore({
        id: Number(selectedStore.id),
        code: selectedStore.storeId,
        name: selectedStore.name,
      });
    } else if (options.length > 0) {
      setStore(options[0]);
    }
  }, [store, selectedStore, options]);

  useEffect(() => {
    if (store) fetchDue(store.id, date);
  }, [store?.id, date, fetchDue]);

  const refetch = useCallback(() => {
    if (store) fetchDue(store.id, date);
  }, [store, date, fetchDue]);

  const STATUS_TABS: { key: "all" | DueStatus; labelKey: string }[] = [
    { key: "all", labelKey: "statusAll" },
    { key: "pending", labelKey: "statusPending" },
    { key: "done", labelKey: "statusDone" },
    { key: "overdue", labelKey: "statusOverdue" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Actions row — flat toolbar, matches the app pattern */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StorePicker
            options={options}
            value={store?.id ?? null}
            onChange={setStore}
            loading={options.length === 0}
          />
          <DatePicker value={date} onChange={setDate} className="w-full sm:w-40" />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={refetch}
          disabled={dueLoading || !store}
          aria-label={t("due.refreshLabel")}
        >
          <RefreshCw className={cn("h-4 w-4", dueLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Status segmented filter with counts */}
      <div className="flex w-full gap-1 rounded-lg border bg-muted/40 p-1 sm:w-auto sm:self-start">
        {STATUS_TABS.map((statusTab) => (
          <button
            key={statusTab.key}
            type="button"
            onClick={() => setStatus(statusTab.key)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
              status === statusTab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(`due.${statusTab.labelKey}`)}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                status === statusTab.key ? "bg-muted" : "bg-muted/60"
              )}
            >
              {counts[statusTab.key]}
            </span>
          </button>
        ))}
      </div>

      {!store ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <Store className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("page.noStoreTitle")}</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {t("page.noStoreDescription")}
            </p>
          </div>
        </div>
      ) : (
        <>
          {dueLoading && !dueData && <DueSkeleton />}
          {dueError && !dueData && <CleaningErrorState error={dueError} onRetry={refetch} />}
          {dueData && (
            <DueList
              storeId={store.id}
              storeCode={store.code}
              date={date}
              items={visibleItems}
              onComplete={completeTask}
              onUncomplete={uncompleteTask}
              canEvaluate={canEvaluate}
              onEvaluate={setChartCell}
              evaluatedVerdicts={evaluatedVerdicts}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ── Tasks ── */
function TasksTab() {
  const t = useTranslations("cleaningChart");
  const { tasks, tasksLoading, tasksError, refetch, createTask, updateTask, deleteTask } =
    useCleaningTasks();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={refetch} disabled={tasksLoading}>
          <RefreshCw className={cn("me-2 h-4 w-4", tasksLoading && "animate-spin")} />
          {t("common.refresh")}
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t("tasks.createTask")}
        </Button>
      </div>

      {tasksLoading && tasks.length === 0 && <TasksSkeleton />}
      {tasksError && tasks.length === 0 && (
        <CleaningErrorState error={tasksError} onRetry={refetch} />
      )}
      {(!tasksLoading || tasks.length > 0) && !tasksError && (
        <TasksList tasks={tasks} onUpdateTask={updateTask} onDeleteTask={deleteTask} />
      )}

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={createTask} />
    </div>
  );
}

/* ── Evaluation ── */
function EvaluationTab() {
  const t = useTranslations("cleaningChart");
  const {
    grid,
    gridLoading,
    gridError,
    periodType,
    periodKey,
    fetchGrid,
    setItemCell,
    setChartCell,
    addInspectionItem,
    removeInspectionItem,
    finalizeStore,
  } = useCleaningEvaluation();

  if (gridLoading && !grid) return <EvaluationSkeleton />;
  if (gridError && !grid)
    return (
      <CleaningErrorState error={gridError} onRetry={() => fetchGrid(periodType, periodKey)} />
    );
  if (!grid)
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <Grid3x3 className="h-8 w-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("page.noEvaluationTitle")}</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {t("page.noEvaluationDescription")}
          </p>
        </div>
      </div>
    );

  return (
    <EvaluationGrid
      grid={grid}
      periodType={periodType}
      periodKey={periodKey}
      onLoadPeriod={fetchGrid}
      onSetItemCell={setItemCell}
      onSetChartCell={setChartCell}
      onAddItem={addInspectionItem}
      onRemoveItem={removeInspectionItem}
      onFinalize={finalizeStore}
    />
  );
}

/* ── Reports (own fetch via /reports/data, own period — independent of Evaluation) ── */
function ReportsTab() {
  const [periodType, setPeriodType] = useState<PeriodType>("week");
  const [periodKey, setPeriodKey] = useState<string>(() => currentPeriodKey("week"));
  const [grid, setGrid] = useState<Grid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<CleaningError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // Cancellation flag: an aborted/stale request must NOT touch state, or its
    // .finally would flip `loading` off for the request that's still in flight
    // (which briefly showed "No report data").
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    cleaningService
      .getReportData(periodType, periodKey, controller.signal)
      .then((g) => {
        if (!cancelled) setGrid(g);
      })
      .catch((err) => {
        if (!cancelled && err instanceof CleaningError) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [periodType, periodKey, reloadKey]);

  const retry = () => setReloadKey((k) => k + 1);

  return (
    <div className="flex flex-col gap-4">
      <PeriodPicker
        periodType={periodType}
        periodKey={periodKey}
        onChange={(type, key) => {
          setPeriodType(type);
          setPeriodKey(key);
        }}
        disabled={loading}
      />

      {error && !grid ? (
        <CleaningErrorState error={error} onRetry={retry} />
      ) : !grid || loading ? (
        // No grid yet → still loading; keep showing the skeleton (never a flash of empty).
        <ReportsSkeleton />
      ) : (
        <ReportsView grid={grid} periodType={periodType} periodKey={periodKey} />
      )}
    </div>
  );
}
