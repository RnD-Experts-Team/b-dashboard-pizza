"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import {
  canAccessCleaningTab,
  canEvaluateCleaning,
  canReopenCleaningEvaluation,
  canManageCleaningSettings,
  type CleaningTabId,
} from "@/lib/auth/cleaning-access";
import { cleaningService, CleaningError } from "@/lib/api/services/cleaning.service";
import type {
  ChartVerdict,
  ChartLockReason,
  EvaluationGrid as Grid,
  DueStatus,
  PeriodType,
} from "@/types/cleaning.types";
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
      toast.success(
        t("page.openedFromNotification", {
          store: pendingCleaningAction.store ?? t("page.openedFromNotificationFallbackStore"),
          period: pendingCleaningAction.periodKey,
        })
      );
    }
    clearPendingCleaningAction();
  }, [pendingCleaningAction, visibleTabs, fetchGrid, clearPendingCleaningAction, t]);

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
                  <span>{t(`tabs.${tab.labelKey}`)}</span>
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
  const { dueData, dueLoading, dueError, fetchDue, setChartCell } = useCleaningStore();

  const [store, setStore] = useState<StoreOption | null>(null);
  const [date, setDate] = useState<string>(todayIso());
  const [status, setStatus] = useState<"all" | DueStatus>("all");

  const canEvaluate = canEvaluateCleaning({ canAccessRoute });

  /**
   * Daily evaluation: the ✓/✗ here grade the `date` PERIOD for the day being
   * viewed, not the week containing it. That's what makes a daily task
   * gradable once per day and — since a date period expects exactly that
   * day's completion — locked until the store actually logs it that day.
   *
   * Unlike a week key, a date key needs no server lookup: the period key IS
   * the date. (The migration guide's "never compute period keys locally"
   * rule is about WEEK keys, whose accounting-calendar numbering diverges
   * from ISO weeks — an unambiguous YYYY-MM-DD has no such problem.)
   */
  const gradingPeriodKey = date;

  /**
   * That day's evaluation grid — fetched here rather than read from the
   * shared store, so browsing Due dates never hijacks the period the
   * Evaluation tab is working in. Supplies both the already-graded verdicts
   * and the completion locks (guide §1-2), so the row can disable and
   * explain before a doomed click rather than after a 422.
   */
  const [dueGrid, setDueGrid] = useState<Grid | null>(null);
  // Stepping through dates fires overlapping fetches; without this, a slow
  // response for an earlier date can land last and show that day's locks
  // under the current one.
  const dueGridRequest = useRef(0);
  const loadDueGrid = useCallback(async () => {
    const token = ++dueGridRequest.current;
    try {
      const fresh = await cleaningService.getEvaluations("date", gradingPeriodKey);
      if (token === dueGridRequest.current) setDueGrid(fresh);
    } catch {
      // Non-fatal: without it the row falls back to reactive 422 detection.
      if (token === dueGridRequest.current) setDueGrid(null);
    }
  }, [gradingPeriodKey]);

  useEffect(() => {
    void loadDueGrid();
  }, [loadDueGrid]);

  // Completing/uncompleting is exactly what clears or creates a lock, so the
  // grid this page reads its locks from has to be reloaded alongside the due
  // list — otherwise the lock from a moment ago survives the completion that
  // just cleared it.
  const completeTaskAndRefreshLock = useCallback(
    async (
      storeId: number,
      taskId: number,
      payload: { date: string; employeeIds: number[]; note?: string; photos?: File[] }
    ) => {
      await useCleaningStore.getState().completeTask(storeId, taskId, payload);
      await loadDueGrid();
    },
    [loadDueGrid]
  );
  const uncompleteTaskAndRefreshLock = useCallback(
    async (storeId: number, taskId: number, date: string) => {
      await useCleaningStore.getState().uncompleteTask(storeId, taskId, date);
      await loadDueGrid();
    },
    [loadDueGrid]
  );

  const evaluateForDate = useCallback(
    async (storeId: number, taskId: number, verdict: ChartVerdict | "empty") => {
      await setChartCell(storeId, taskId, verdict, {
        periodType: "date",
        periodKey: gradingPeriodKey,
      });
      await loadDueGrid();
    },
    [gradingPeriodKey, setChartCell, loadDueGrid]
  );

  const evaluatedVerdicts = useMemo(() => {
    const map: Record<number, ChartVerdict> = {};
    const row = store ? dueGrid?.rows.find((r) => r.storeId === store.id) : null;
    if (!row) return map;
    for (const cells of Object.values(row.chart)) {
      for (const cell of cells) {
        if (cell.verdict) map[cell.taskId] = cell.verdict;
      }
    }
    return map;
  }, [dueGrid, store]);
  // Only entries for a currently-locked task are included; an absent entry
  // means either the task is editable, or the grid hasn't loaded yet
  // (DueList's own reactive fallback covers that gap).
  const lockedTaskReasons = useMemo(() => {
    const map: Record<number, ChartLockReason> = {};
    const row = store ? dueGrid?.rows.find((r) => r.storeId === store.id) : null;
    if (!row) return map;
    for (const cells of Object.values(row.chart)) {
      for (const cell of cells) {
        if (cell.evaluable === false && cell.lockReason) map[cell.taskId] = cell.lockReason;
      }
    }
    return map;
  }, [dueGrid, store]);

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
              "inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors sm:flex-none sm:px-3",
              status === statusTab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="truncate">{t(`due.${statusTab.labelKey}`)}</span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 text-xs tabular-nums",
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
              onComplete={completeTaskAndRefreshLock}
              onUncomplete={uncompleteTaskAndRefreshLock}
              canEvaluate={canEvaluate}
              onEvaluate={evaluateForDate}
              evaluatedVerdicts={evaluatedVerdicts}
              lockedTaskReasons={lockedTaskReasons}
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
  const { canAccessRoute } = useAuthStore();
  const canReopen = canReopenCleaningEvaluation({ canAccessRoute });
  const canManageSettings = canManageCleaningSettings({ canAccessRoute });
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
    updateInspectionItemWeight,
    allocateWeight,
    deleteAllocation,
    copyAllocation,
    removeAllocations,
    finalizeStore,
    reopenStore,
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
      onUpdateItemWeight={updateInspectionItemWeight}
      onFinalize={finalizeStore}
      canReopen={canReopen}
      onReopen={reopenStore}
      onAllocateWeight={allocateWeight}
      onDeleteAllocation={deleteAllocation}
      onCopyAllocation={copyAllocation}
      onRemoveAllocations={removeAllocations}
      onRefetchGrid={() => fetchGrid(periodType, periodKey)}
      canManageSettings={canManageSettings}
    />
  );
}

/* ── Reports (own fetch via /reports/data, own period — independent of Evaluation) ── */
function ReportsTab() {
  const [periodType, setPeriodType] = useState<PeriodType>("week");
  // Empty until `PeriodPicker` resolves the server's current period for this
  // type (see the migration guide §4 — never computed locally). The fetch
  // effect below waits for a non-empty key before calling the API, since an
  // empty `period_key` is rejected upstream with 422.
  const [periodKey, setPeriodKey] = useState<string>("");
  const [grid, setGrid] = useState<Grid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<CleaningError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!periodKey) return;
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
