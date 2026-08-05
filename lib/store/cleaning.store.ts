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
    value: ItemValue
  ) => Promise<void>;
  setChartCell: (
    storeId: number,
    cleaningTaskId: number,
    verdict: ChartVerdict
  ) => Promise<void>;
  addInspectionItem: (name: string) => Promise<void>;
  removeInspectionItem: (id: number) => Promise<void>;
  finalizeStore: (storeId: number) => Promise<void>;

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

  setItemCell: async (storeId, inspectionItemId, columnName, value) => {
    const { periodType, periodKey } = get();
    const row = await cleaningService.setCell({
      store_id: storeId,
      period_type: periodType,
      period_key: periodKey,
      kind: "item",
      inspection_item_id: inspectionItemId,
      value,
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

  addInspectionItem: async (name) => {
    await cleaningService.addInspectionItem(name);
    const { periodType, periodKey, fetchGrid } = get();
    await fetchGrid(periodType, periodKey);
  },

  removeInspectionItem: async (id) => {
    await cleaningService.deleteInspectionItem(id);
    const { periodType, periodKey, fetchGrid } = get();
    await fetchGrid(periodType, periodKey);
  },

  finalizeStore: async (storeId) => {
    const { periodType, periodKey } = get();
    await cleaningService.finalizeStore({
      store_id: storeId,
      period_type: periodType,
      period_key: periodKey,
    });
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
