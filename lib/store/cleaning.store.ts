import { create } from "zustand";
import { cleaningService, CleaningError } from "@/lib/api/services/cleaning.service";
import type {
  DueResponse,
  CleaningTask,
  EvaluationGrid,
  EvalRow,
  ItemValue,
  ChartVerdict,
  PeriodType,
  CompleteTaskPayload,
  CreateTaskPayload,
  UpdateTaskPayload,
} from "@/types/cleaning.types";

interface AllocationAmount {
  targetTaskId: number;
  amount: number;
}

function asError(err: unknown): CleaningError {
  return err instanceof CleaningError
    ? err
    : new CleaningError("Something went wrong.", "UNKNOWN");
}

interface CleaningState {
  /* ── Track 1: Due ── */
  dueData: DueResponse | null;
  dueLoading: boolean;
  dueError: CleaningError | null;
  fetchDue: (storeId: number, date: string) => Promise<void>;
  completeTask: (
    storeId: number,
    taskId: number,
    payload: CompleteTaskPayload
  ) => Promise<void>;
  uncompleteTask: (storeId: number, taskId: number, date: string) => Promise<void>;

  /* ── Track 1: Tasks ── */
  tasks: CleaningTask[];
  tasksLoading: boolean;
  tasksError: CleaningError | null;
  fetchTasks: () => Promise<void>;
  createTask: (payload: CreateTaskPayload) => Promise<CleaningTask>;
  updateTask: (taskId: number, payload: UpdateTaskPayload) => Promise<CleaningTask>;
  deleteTask: (taskId: number) => Promise<void>;

  /* ── Track 2: Evaluation grid ── */
  grid: EvaluationGrid | null;
  gridLoading: boolean;
  gridError: CleaningError | null;
  periodType: PeriodType;
  periodKey: string;
  setPeriod: (periodType: PeriodType, periodKey: string) => void;
  fetchGrid: (periodType: PeriodType, periodKey: string) => Promise<void>;
  setItemCell: (
    storeId: number,
    inspectionItemId: number,
    columnName: string,
    value: ItemValue,
    note?: string,
    images?: File[]
  ) => Promise<void>;
  setChartCell: (
    storeId: number,
    cleaningTaskId: number,
    verdict: ChartVerdict | "empty"
  ) => Promise<void>;
  addInspectionItem: (name: string, weight?: number) => Promise<void>;
  removeInspectionItem: (id: number) => Promise<void>;
  /** PUT /inspection-items/{id} — weights are snapshotted per graded cell, so
   *  this never re-scores an evaluation that already went out. */
  updateInspectionItemWeight: (id: number, weight: number) => Promise<void>;
  /** Replaces the ENTIRE split for one source task in a single transaction
   *  (amounts must sum to the source task's weight exactly, server-enforced). */
  allocateWeight: (
    storeId: number,
    sourceTaskId: number,
    amounts: AllocationAmount[]
  ) => Promise<void>;
  deleteAllocation: (storeId: number, sourceTaskId: number) => Promise<void>;
  /** Throws (does not swallow) a CONFLICT CleaningError with `.missing` set
   *  when the evaluation still has ungraded cells — the grid needs that to
   *  show which cells, not just "incomplete". */
  finalizeStore: (storeId: number) => Promise<void>;
  /** Super Admin only — 403 otherwise. Clears the lock and discards the
   *  frozen scores; the caller should refetch the grid after this resolves. */
  reopenStore: (storeId: number) => Promise<void>;

  reset: () => void;
}

export const useCleaningStore = create<CleaningState>((set, get) => ({
  /* ── Due ── */
  dueData: null,
  dueLoading: false,
  dueError: null,

  fetchDue: async (storeId, date) => {
    set({ dueLoading: true, dueError: null });
    try {
      const dueData = await cleaningService.getDue(storeId, date);
      set({ dueData, dueLoading: false });
    } catch (err) {
      set({ dueError: asError(err), dueLoading: false });
    }
  },

  completeTask: async (storeId, taskId, payload) => {
    await cleaningService.completeTask(storeId, taskId, payload);
    // Re-fetch the due list so computed statuses refresh.
    await get().fetchDue(storeId, payload.date);
  },

  uncompleteTask: async (storeId, taskId, date) => {
    await cleaningService.uncompleteTask(storeId, taskId, date);
    await get().fetchDue(storeId, date);
  },

  /* ── Tasks ── */
  tasks: [],
  tasksLoading: false,
  tasksError: null,

  fetchTasks: async () => {
    set({ tasksLoading: true, tasksError: null });
    try {
      const tasks = await cleaningService.listTasks();
      set({ tasks, tasksLoading: false });
    } catch (err) {
      set({ tasksError: asError(err), tasksLoading: false });
    }
  },

  createTask: async (payload) => {
    const task = await cleaningService.createTask(payload);
    set((s) => ({ tasks: [task, ...s.tasks] }));
    return task;
  },

  updateTask: async (taskId, payload) => {
    const task = await cleaningService.updateTask(taskId, payload);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? task : t)) }));
    return task;
  },

  deleteTask: async (taskId) => {
    await cleaningService.deleteTask(taskId);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
  },

  /* ── Evaluation grid ── */
  grid: null,
  gridLoading: false,
  gridError: null,
  periodType: "week",
  periodKey: "",

  setPeriod: (periodType, periodKey) => set({ periodType, periodKey }),

  fetchGrid: async (periodType, periodKey) => {
    set({ gridLoading: true, gridError: null, periodType, periodKey });
    try {
      const grid = await cleaningService.getEvaluations(periodType, periodKey);
      set({ grid, gridLoading: false });
    } catch (err) {
      set({ gridError: asError(err), gridLoading: false });
    }
  },

  setItemCell: async (storeId, inspectionItemId, columnName, value, note, images) => {
    const { periodType, periodKey } = get();
    const row = await cleaningService.setCell({
      store_id: storeId,
      period_type: periodType,
      period_key: periodKey,
      kind: "item",
      inspection_item_id: inspectionItemId,
      value,
      note,
      images,
    });
    replaceRow(set, storeId, row);
  },

  setChartCell: async (storeId, cleaningTaskId, verdict) => {
    const { periodType, periodKey } = get();
    const row = await cleaningService.setCell({
      store_id: storeId,
      period_type: periodType,
      period_key: periodKey,
      kind: "chart",
      cleaning_task_id: cleaningTaskId,
      verdict,
    });
    replaceRow(set, storeId, row);
  },

  addInspectionItem: async (name, weight) => {
    await cleaningService.addInspectionItem(name, weight);
    const { periodType, periodKey, fetchGrid } = get();
    await fetchGrid(periodType, periodKey);
  },

  removeInspectionItem: async (id) => {
    await cleaningService.deleteInspectionItem(id);
    const { periodType, periodKey, fetchGrid } = get();
    await fetchGrid(periodType, periodKey);
  },

  updateInspectionItemWeight: async (id, weight) => {
    await cleaningService.updateInspectionItem(id, { weight });
    const { periodType, periodKey, fetchGrid } = get();
    await fetchGrid(periodType, periodKey);
  },

  allocateWeight: async (storeId, sourceTaskId, amounts) => {
    const { periodType, periodKey, fetchGrid } = get();
    await cleaningService.setAllocation({
      store_id: storeId,
      period_type: periodType,
      period_key: periodKey,
      source_task_id: sourceTaskId,
      amounts: amounts.map((a) => ({ target_task_id: a.targetTaskId, amount: a.amount })),
    });
    await fetchGrid(periodType, periodKey);
  },

  deleteAllocation: async (storeId, sourceTaskId) => {
    const { periodType, periodKey, fetchGrid } = get();
    await cleaningService.deleteAllocation({
      store_id: storeId,
      period_type: periodType,
      period_key: periodKey,
      source_task_id: sourceTaskId,
    });
    await fetchGrid(periodType, periodKey);
  },

  finalizeStore: async (storeId) => {
    const { periodType, periodKey, fetchGrid } = get();
    await cleaningService.finalizeStore({
      store_id: storeId,
      period_type: periodType,
      period_key: periodKey,
    });
    // The response carries no row — refetch so `finalizedAt`/`scoreFrozen`
    // reflect the lock immediately instead of on the next unrelated fetch.
    await fetchGrid(periodType, periodKey);
  },

  reopenStore: async (storeId) => {
    const { periodType, periodKey, fetchGrid } = get();
    await cleaningService.reopenStore({
      store_id: storeId,
      period_type: periodType,
      period_key: periodKey,
    });
    await fetchGrid(periodType, periodKey);
  },

  reset: () =>
    set({
      dueData: null,
      dueError: null,
      dueLoading: false,
      tasks: [],
      tasksError: null,
      grid: null,
      gridError: null,
    }),
}));

/** Swap a single recalculated row into the grid after an upsert. */
function replaceRow(
  set: (fn: (s: CleaningState) => Partial<CleaningState>) => void,
  storeId: number,
  row: EvalRow
) {
  set((s) => {
    if (!s.grid) return {};
    return {
      grid: {
        ...s.grid,
        rows: s.grid.rows.map((r) => (r.storeId === storeId ? row : r)),
      },
    };
  });
}
