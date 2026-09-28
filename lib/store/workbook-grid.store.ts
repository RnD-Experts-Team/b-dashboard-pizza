import { create } from "zustand";
import { workbooksService } from "@/lib/api/services/workbooks.service";
import { readCellMismatch, toErrorState } from "@/lib/workbooks/errors";
import { toWireValue } from "@/lib/workbooks/cells";
import { EMPTY_ROWS_QUERY } from "@/lib/workbooks/grid-url";
import type {
  Page,
  RowsQuery,
  Workbook,
  WorkbookColumn,
  WorkbookRow,
  WorkbooksErrorState,
} from "@/types/workbooks.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  One open workbook: its detail, the grid page, the query, and inline      */
/*  cell saves.                                                               */
/*                                                                            */
/*  Cell saves are optimistic and send ONE key (updates are partial). On     */
/*  failure the old value comes back and the error sits on that cell.        */
/* ────────────────────────────────────────────────────────────────────────── */

let _wbCtrl: AbortController | null = null;
let _rowsCtrl: AbortController | null = null;

export const cellKey = (rowId: number, columnId: number) => `${rowId}:${columnId}`;

interface GridState {
  workbookId: number | null;
  workbook: Workbook | null;
  workbookLoading: boolean;
  workbookError: WorkbooksErrorState | null;

  rows: Page<WorkbookRow> | null;
  rowsLoading: boolean;
  rowsRefreshing: boolean;
  rowsError: WorkbooksErrorState | null;
  query: RowsQuery;

  savingCells: Record<string, boolean>;
  cellErrors: Record<string, string>;
  /** select columns: the allowed values a mismatch told us, by column id. */
  allowedOverride: Record<string, string[]>;
  /** rowId → timestamp of the last successful save, for the flash. */
  flashed: Record<number, number>;

  open: (workbookId: number, query: RowsQuery) => Promise<void>;
  fetchWorkbook: () => Promise<void>;
  fetchRows: (query?: RowsQuery) => Promise<void>;
  saveCell: (row: WorkbookRow, column: WorkbookColumn, raw: string) => Promise<boolean>;
  clearCellError: (rowId: number, columnId: number) => void;
  upsertRow: (row: WorkbookRow) => void;
  removeRow: (rowId: number) => void;
  setColumns: (columns: WorkbookColumn[]) => void;
  setWorkbook: (workbook: Workbook) => void;
  reorderLocal: (orderedIds: number[]) => void;
  reset: () => void;
}

const INITIAL = {
  workbookId: null,
  workbook: null,
  workbookLoading: false,
  workbookError: null,
  rows: null,
  rowsLoading: false,
  rowsRefreshing: false,
  rowsError: null,
  query: EMPTY_ROWS_QUERY,
  savingCells: {},
  cellErrors: {},
  allowedOverride: {},
  flashed: {},
};

export const useWorkbookGridStore = create<GridState>()((set, get) => ({
  ...INITIAL,

  async open(workbookId, query) {
    if (get().workbookId !== workbookId) {
      _wbCtrl?.abort();
      _rowsCtrl?.abort();
      set({ ...INITIAL, workbookId, query });
    }
    await Promise.all([get().fetchWorkbook(), get().fetchRows(query)]);
  },

  async fetchWorkbook() {
    const id = get().workbookId;
    if (id == null) return;
    _wbCtrl?.abort();
    const controller = new AbortController();
    _wbCtrl = controller;
    set({ workbookLoading: !get().workbook, workbookError: null });
    try {
      const workbook = await workbooksService.getWorkbook(id, controller.signal);
      if (controller.signal.aborted || _wbCtrl !== controller) return;
      set({ workbook, workbookLoading: false });
    } catch (err) {
      if (controller.signal.aborted || _wbCtrl !== controller) return;
      set({ workbookError: toErrorState(err), workbookLoading: false });
    }
  },

  async fetchRows(query) {
    const id = get().workbookId;
    if (id == null) return;
    _rowsCtrl?.abort();
    const controller = new AbortController();
    _rowsCtrl = controller;
    const next = query ?? get().query;
    const has = get().rows !== null;
    set({ query: next, rowsLoading: !has, rowsRefreshing: has, rowsError: null });
    try {
      const rows = await workbooksService.listRows(id, next, controller.signal);
      if (controller.signal.aborted || _rowsCtrl !== controller) return;
      // A page past the end (rows deleted elsewhere) — step back to the last one.
      if (rows.items.length === 0 && next.page > 1 && rows.lastPage < next.page) {
        void get().fetchRows({ ...next, page: Math.max(1, rows.lastPage) });
        return;
      }
      set({ rows, rowsLoading: false, rowsRefreshing: false });
    } catch (err) {
      if (controller.signal.aborted || _rowsCtrl !== controller) return;
      set({ rowsError: toErrorState(err), rowsLoading: false, rowsRefreshing: false });
    }
  },

  async saveCell(row, column, raw) {
    const workbookId = get().workbookId;
    if (workbookId == null) return false;
    const key = cellKey(row.id, column.id);
    const wire = toWireValue(raw);
    const previous = row.cells[String(column.id)] ?? null;
    const optimistic: WorkbookRow["cells"][string] =
      column.type === "boolean" && wire != null ? wire === "true" : wire;

    patchRow(row.id, { [String(column.id)]: optimistic });
    set((s) => {
      const cellErrors = { ...s.cellErrors };
      delete cellErrors[key];
      return { savingCells: { ...s.savingCells, [key]: true }, cellErrors };
    });

    try {
      const saved = await workbooksService.updateRow(workbookId, row.id, {
        cells: { [String(column.id)]: wire },
      });
      get().upsertRow(saved);
      set((s) => ({
        savingCells: { ...s.savingCells, [key]: false },
        flashed: { ...s.flashed, [row.id]: Date.now() },
      }));
      return true;
    } catch (err) {
      patchRow(row.id, { [String(column.id)]: previous });
      const mismatch = readCellMismatch(err);
      const state = toErrorState(err);
      set((s) => ({
        savingCells: { ...s.savingCells, [key]: false },
        cellErrors: { ...s.cellErrors, [key]: mismatch?.message ?? state.message },
        allowedOverride:
          mismatch?.allowed && mismatch.allowed.length > 0
            ? { ...s.allowedOverride, [String(column.id)]: mismatch.allowed }
            : s.allowedOverride,
      }));
      throw err;
    }

    function patchRow(rowId: number, cells: WorkbookRow["cells"]) {
      set((s) =>
        s.rows
          ? {
              rows: {
                ...s.rows,
                items: s.rows.items.map((r) =>
                  r.id === rowId ? { ...r, cells: { ...r.cells, ...cells } } : r,
                ),
              },
            }
          : {},
      );
    }
  },

  clearCellError(rowId, columnId) {
    set((s) => {
      const cellErrors = { ...s.cellErrors };
      delete cellErrors[cellKey(rowId, columnId)];
      return { cellErrors };
    });
  },

  upsertRow(row) {
    set((s) => {
      if (!s.rows) return {};
      const exists = s.rows.items.some((r) => r.id === row.id);
      return {
        rows: {
          ...s.rows,
          items: exists ? s.rows.items.map((r) => (r.id === row.id ? row : r)) : s.rows.items,
        },
      };
    });
  },

  removeRow(rowId) {
    set((s) =>
      s.rows
        ? {
            rows: {
              ...s.rows,
              items: s.rows.items.filter((r) => r.id !== rowId),
              total: Math.max(0, s.rows.total - 1),
            },
          }
        : {},
    );
  },

  setColumns(columns) {
    set((s) => (s.workbook ? { workbook: { ...s.workbook, columns } } : {}));
  },

  setWorkbook(workbook) {
    // Update responses may omit columns/breadcrumb — keep what we have.
    set((s) => ({
      workbook: {
        ...workbook,
        columns: workbook.columns.length ? workbook.columns : (s.workbook?.columns ?? []),
        breadcrumb: workbook.breadcrumb.length ? workbook.breadcrumb : (s.workbook?.breadcrumb ?? []),
      },
    }));
  },

  reorderLocal(orderedIds) {
    set((s) => {
      if (!s.rows) return {};
      const byId = new Map(s.rows.items.map((r) => [r.id, r]));
      const items = orderedIds.map((id) => byId.get(id)).filter(Boolean) as WorkbookRow[];
      return { rows: { ...s.rows, items } };
    });
  },

  reset() {
    _wbCtrl?.abort();
    _rowsCtrl?.abort();
    set({ ...INITIAL });
  },
}));
