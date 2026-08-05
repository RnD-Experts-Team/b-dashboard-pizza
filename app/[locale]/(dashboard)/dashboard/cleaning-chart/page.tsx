"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Grid3x3, FileBarChart, Plus, RefreshCw, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useCleaningTasks, useCleaningEvaluation, todayIso } from "@/lib/hooks/use-cleaning";
import { useCleaningStore } from "@/lib/store/cleaning.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import { canAccessCleaningTab, type CleaningTabId } from "@/lib/auth/cleaning-access";
import { cleaningService, CleaningError } from "@/lib/api/services/cleaning.service";
import type { EvaluationGrid as Grid, DueStatus } from "@/types/cleaning.types";
import {
  DueList,
  TasksList,
  CreateTaskDialog,
  EvaluationGrid,
  ReportsView,
  CleaningErrorState,
  StorePicker,
  DueSkeleton,
  TasksSkeleton,
  EvaluationSkeleton,
  ReportsSkeleton,
  type StoreOption,
} from "@/components/cleaning";

const TAB_DEFS: { id: CleaningTabId; label: string; icon: LucideIcon; render: () => React.ReactNode }[] = [
  { id: "due", label: "Due Today", icon: CalendarDays, render: () => <DueTab /> },
  { id: "tasks", label: "Tasks", icon: ClipboardList, render: () => <TasksTab /> },
  { id: "evaluation", label: "Evaluation", icon: Grid3x3, render: () => <EvaluationTab /> },
  { id: "reports", label: "Reports", icon: FileBarChart, render: () => <ReportsTab /> },
];

/** Static class per column count — Tailwind can't resolve a templated grid-cols-N. */
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export default function CleaningChartPage() {
  const { selectedStore } = useSelectedStoreStore();
  const { overviewStores, canAccessRoute, hasAnyRole } = useAuthStore();
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;

  const visibleTabs = useMemo(
    () =>
      TAB_DEFS.filter((t) =>
        canAccessCleaningTab(t.id, { canAccessRoute, hasAnyRole }, effectiveStoreId)
      ),
    [canAccessRoute, hasAnyRole, effectiveStoreId]
  );

  const [activeTab, setActiveTab] = useState<CleaningTabId>("due");

  // If the active tab becomes hidden (e.g. permissions load after mount, or the
  // selected store changes what's scoped-accessible), fall back to the first
  // tab the user can actually see.
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cleaning Chart"
        description="Track recurring cleaning tasks, grade store evaluations, and export reports."
      />

      {visibleTabs.length === 0 ? (
        <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
          You don&apos;t have permission to access the Cleaning Chart.
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as CleaningTabId)}
          className="w-full"
        >
          <TabsList
            className={cn(
              "grid w-full sm:inline-grid sm:w-auto",
              GRID_COLS[visibleTabs.length] ?? "grid-cols-4"
            )}
          >
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-2">
                <t.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {visibleTabs.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-4">
              {t.render()}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

/* ── Due Today ── */
function DueTab() {
  // Same store list the sidebar's own switcher uses (overviewStores, loaded once
  // at login from /auth/general-overview) — already scoped to whatever stores
  // THIS user can access (e.g. a store manager's 2 assigned stores), unlike
  // storeService.getStores() which lists every company store regardless of role.
  const { overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();
  const {
    dueData,
    dueLoading,
    dueError,
    fetchDue,
    completeTask,
    uncompleteTask,
  } = useCleaningStore();

  const [store, setStore] = useState<StoreOption | null>(null);
  const [date, setDate] = useState<string>(todayIso());
  const [status, setStatus] = useState<"all" | DueStatus>("all");

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

  const STATUS_TABS: { key: "all" | DueStatus; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "done", label: "Done" },
    { key: "overdue", label: "Overdue" },
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
          aria-label="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", dueLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Status segmented filter with counts */}
      <div className="flex w-full gap-1 rounded-lg border bg-muted/40 p-1 sm:w-auto sm:self-start">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatus(t.key)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
              status === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                status === t.key ? "bg-muted" : "bg-muted/60"
              )}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {!store ? (
        <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
          Select a store to see what&apos;s due.
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
            />
          )}
        </>
      )}
    </div>
  );
}

/* ── Tasks ── */
function TasksTab() {
  const { tasks, tasksLoading, tasksError, refetch, createTask, updateTask, deleteTask } =
    useCleaningTasks();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={refetch} disabled={tasksLoading}>
          <RefreshCw className={cn("me-2 h-4 w-4", tasksLoading && "animate-spin")} />
          Refresh
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          Create Task
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
      <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
        No evaluation data.
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

/* ── Reports (own fetch via /reports/data) ── */
function ReportsTab() {
  // Reuse the evaluation period selection from the shared store.
  const { periodType, periodKey } = useCleaningEvaluation();
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

  if (error && !grid) return <CleaningErrorState error={error} onRetry={retry} />;
  // No grid yet → still loading; keep showing the skeleton (never a flash of empty).
  if (!grid || loading) return <ReportsSkeleton />;

  return <ReportsView grid={grid} periodType={periodType} periodKey={periodKey} />;
}
