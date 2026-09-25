import axios from "axios";
import type {
  ApiCappedBy,
  ApiColumn,
  ApiColumnTypeOption,
  ApiEffectiveVisibility,
  ApiFolder,
  ApiPaginator,
  ApiRow,
  ApiStoreRef,
  ApiUserRef,
  ApiViewerCan,
  ApiVisibilityOption,
  ApiWorkbook,
  CappedBy,
  ColumnDraftPayload,
  CreateFolderPayload,
  CreateWorkbookPayload,
  EffectiveVisibility,
  FolderListQuery,
  Page,
  RowPayload,
  RowsQuery,
  StoreRef,
  UpdateFolderPayload,
  UpdateWorkbookPayload,
  UserRef,
  ViewerCan,
  VisibilityPayload,
  Workbook,
  WorkbookColumn,
  WorkbookFolder,
  WorkbookListQuery,
  WorkbookOptions,
  WorkbookRow,
  WorkbooksErrorCode,
} from "@/types/workbooks.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Workbooks service — ToolboxPizza via /api/toolbox/*                      */
/*                                                                            */
/*  Same shape as maintenance-tickets.service.ts: plain axios against the    */
/*  internal routes, a bearer token from the persisted auth store, and one   */
/*  error class every caller can branch on.                                  */
/* ────────────────────────────────────────────────────────────────────────── */

const BASE = "/api/toolbox";
const TIMEOUT_MS = 30_000;

/* ── Error ───────────────────────────────────────────────────────────────── */

export class WorkbooksError extends Error {
  /** Client-side category — drives icon / retry. */
  readonly code: WorkbooksErrorCode;
  /** The backend's own `error.code`, e.g. WORKBOOK_FOLDER_NOT_EMPTY. */
  readonly serverCode: string | null;
  readonly status: number | null;
  readonly retryable: boolean;
  /** Laravel 422 bag: { field: [messages] }. */
  readonly validationErrors?: Record<string, string[]>;
  /** The nearest ancestor that withheld the permission, when there is one. */
  readonly cappedBy: CappedBy | null;
  /** The raw `error` block: child_folders, workbooks, force_required, allowed, column_id… */
  readonly details: Record<string, unknown>;

  constructor(
    message: string,
    code: WorkbooksErrorCode,
    opts: {
      serverCode?: string | null;
      status?: number | null;
      validationErrors?: Record<string, string[]>;
      cappedBy?: CappedBy | null;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
    this.name = "WorkbooksError";
    this.code = code;
    this.serverCode = opts.serverCode ?? null;
    this.status = opts.status ?? null;
    this.validationErrors = opts.validationErrors;
    this.cappedBy = opts.cappedBy ?? null;
    this.details = opts.details ?? {};
    this.retryable = ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR"].includes(code);
  }
}

/* ── Token ───────────────────────────────────────────────────────────────── */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth-token");
  if (!raw) return null;
  try {
    return JSON.parse(raw)?.state?.token ?? null;
  } catch {
    return null;
  }
}

function headers(): Record<string, string> {
  const token = getToken();
  if (!token) {
    throw new WorkbooksError("You must be logged in to perform this action.", "NOT_AUTHENTICATED");
  }
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

function requireStore(storeCode: string | null | undefined): string {
  if (!storeCode) {
    throw new WorkbooksError("Select a store first.", "NO_STORE");
  }
  return encodeURIComponent(storeCode);
}

/* ── Axios error → WorkbooksError ────────────────────────────────────────── */

function handleAxiosError(err: unknown): never {
  if (err instanceof WorkbooksError) throw err;
  if (axios.isCancel(err) || (axios.isAxiosError(err) && err.code === "ERR_CANCELED")) {
    throw new WorkbooksError("Request cancelled.", "CANCELLED");
  }
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? null;
    const data = (err.response?.data ?? {}) as {
      message?: string;
      errors?: Record<string, string[]>;
      error?: Record<string, unknown> & { code?: string; message?: string; capped_by?: ApiCappedBy };
    };
    const block = data.error && typeof data.error === "object" ? data.error : {};
    const serverCode = typeof block.code === "string" ? block.code : null;
    // Always the server's own sentence when it sent one.
    const message =
      data.message || (typeof block.message === "string" ? block.message : "") || err.message;
    const opts = {
      serverCode,
      status,
      cappedBy: toCappedBy(block.capped_by),
      details: block as Record<string, unknown>,
      validationErrors: data.errors,
    };

    // Our own proxy's 502: the toolbox host couldn't be reached at all (DNS,
    // refused connection) — that's a network problem, not a server one.
    if (status === 502 && serverCode === "UPSTREAM_ERROR") {
      throw new WorkbooksError("Could not reach the toolbox service.", "NETWORK_ERROR", opts);
    }
    if (err.code === "ECONNABORTED" || status === 504) {
      throw new WorkbooksError("The toolbox took too long to answer. Please try again.", "TIMEOUT", opts);
    }
    if (status === 401) throw new WorkbooksError(message, "NOT_AUTHENTICATED", opts);
    if (status === 400) throw new WorkbooksError(message, "BAD_REQUEST", opts);
    if (status === 403) throw new WorkbooksError(message, "FORBIDDEN", opts);
    if (status === 404) throw new WorkbooksError(message, "NOT_FOUND", opts);
    if (status === 409) throw new WorkbooksError(message, "CONFLICT", opts);
    if (status === 422) {
      throw new WorkbooksError(message || "Please check the highlighted fields.", "VALIDATION_ERROR", opts);
    }
    if (status === 429) throw new WorkbooksError("Too many requests. Wait a moment.", "RATE_LIMITED", opts);
    if (status != null && status >= 500) {
      throw new WorkbooksError("The toolbox service had a problem. Please try again.", "SERVER_ERROR", opts);
    }
    if (!err.response) {
      throw new WorkbooksError("Network error. Check your connection.", "NETWORK_ERROR", opts);
    }
  }
  throw new WorkbooksError("An unexpected error occurred.", "UNKNOWN");
}

async function call<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    const res = await fn();
    return res.data;
  } catch (err) {
    handleAxiosError(err);
  }
}

/* ── Transforms ──────────────────────────────────────────────────────────── */

function toCappedBy(raw: ApiCappedBy | null | undefined): CappedBy | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    type: raw.type,
    id: raw.id,
    visibility: raw.visibility,
    visibilityLabel: raw.visibility_label ?? null,
  };
}

function toEffective(raw: ApiEffectiveVisibility | null | undefined): EffectiveVisibility | null {
  if (!raw) return null;
  return { canView: raw.can_view, canEdit: raw.can_edit, cappedBy: toCappedBy(raw.capped_by) };
}

function toStore(raw: ApiStoreRef | null | undefined): StoreRef | null {
  return raw ? { id: raw.id, storeNumber: raw.store_number, name: raw.name } : null;
}

function toUser(raw: ApiUserRef | null | undefined): UserRef | null {
  return raw ? { id: raw.id, name: raw.name } : null;
}

/** Missing flags are false — a button we can't prove works is not rendered. */
function toCan(raw: { can?: ApiViewerCan } | undefined): ViewerCan {
  const c = raw?.can ?? {};
  return {
    view: c.view ?? true,
    edit: c.edit ?? false,
    manageColumns: c.manage_columns ?? false,
    addRows: c.add_rows ?? false,
    changeVisibility: c.change_visibility ?? false,
    delete: c.delete ?? false,
  };
}

function toFolder(raw: ApiFolder): WorkbookFolder {
  return {
    id: raw.id,
    parentId: raw.parent_id ?? null,
    name: raw.name,
    description: raw.description ?? null,
    store: toStore(raw.store),
    createdBy: toUser(raw.created_by),
    visibility: raw.visibility,
    visibilityLabel: raw.visibility_label,
    visibilityRoles: raw.visibility_roles ?? null,
    effective: toEffective(raw.effective_visibility),
    workbooksCount: raw.workbooks_count ?? null,
    childrenCount: raw.children_count ?? null,
    breadcrumb: raw.breadcrumb ?? [],
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    can: toCan(raw.viewer),
  };
}

function toColumn(raw: ApiColumn): WorkbookColumn {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    typeLabel: raw.type_label ?? null,
    options: raw.options ?? null,
    required: Boolean(raw.required),
    position: raw.position ?? 0,
  };
}

function toWorkbook(raw: ApiWorkbook): Workbook {
  return {
    id: raw.id,
    folderId: raw.folder_id,
    name: raw.name,
    description: raw.description ?? null,
    store: toStore(raw.store),
    createdBy: toUser(raw.created_by),
    visibility: raw.visibility,
    visibilityLabel: raw.visibility_label,
    visibilityRoles: raw.visibility_roles ?? null,
    effective: toEffective(raw.effective_visibility),
    columns: (raw.columns ?? []).map(toColumn).sort((a, b) => a.position - b.position),
    breadcrumb: raw.breadcrumb ?? [],
    rowsCount: raw.rows_count ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    can: toCan(raw.viewer),
  };
}

function toRow(raw: ApiRow): WorkbookRow {
  return {
    id: raw.id,
    workbookId: raw.workbook_id,
    position: raw.position,
    store: toStore(raw.store),
    createdBy: toUser(raw.created_by),
    visibility: raw.visibility,
    visibilityLabel: raw.visibility_label,
    visibilityRoles: raw.visibility_roles ?? null,
    cells: raw.cells ?? {},
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    can: toCan(raw.viewer),
  };
}

function toPage<A, T>(raw: ApiPaginator<A>, map: (a: A) => T): Page<T> {
  return {
    items: (raw.data ?? []).map(map),
    currentPage: raw.current_page ?? 1,
    lastPage: raw.last_page ?? 1,
    perPage: raw.per_page ?? 25,
    from: raw.from ?? null,
    to: raw.to ?? null,
    total: raw.total ?? 0,
  };
}

/* ── Catalogue ───────────────────────────────────────────────────────────── */

async function getOptions(signal?: AbortSignal): Promise<WorkbookOptions> {
  const res = await call<{ data: { visibilities: ApiVisibilityOption[]; column_types: ApiColumnTypeOption[] } }>(
    () => axios.get(`${BASE}/workbook-options`, { headers: headers(), timeout: TIMEOUT_MS, signal }),
  );
  return {
    visibilities: (res.data?.visibilities ?? []).map((v) => ({
      value: v.value,
      label: v.label,
      audience: v.audience,
      audienceLabel: v.audience_label,
      grantsEdit: v.grants_edit,
      needsRoles: v.needs_roles,
    })),
    columnTypes: (res.data?.column_types ?? []).map((c) => ({
      value: c.value,
      label: c.label,
      needsOptions: c.needs_options,
    })),
  };
}

/* ── Folders ─────────────────────────────────────────────────────────────── */

function folderParams(q: FolderListQuery): Record<string, string | number> {
  const p: Record<string, string | number> = {};
  // Three distinct states: omitted (whole tree), "" (roots), number (children).
  if (q.parentId === null) p.parent_id = "";
  else if (typeof q.parentId === "number") p.parent_id = q.parentId;
  if (q.search?.trim()) p.search = q.search.trim();
  if (q.sortBy) p.sort_by = q.sortBy;
  if (q.sortOrder) p.sort_order = q.sortOrder;
  if (q.perPage) p.per_page = q.perPage;
  if (q.page) p.page = q.page;
  return p;
}

async function listFolders(q: FolderListQuery, signal?: AbortSignal): Promise<Page<WorkbookFolder>> {
  const res = await call<{ data: ApiPaginator<ApiFolder> }>(() =>
    axios.get(`${BASE}/workbook-folders`, {
      headers: headers(),
      params: folderParams(q),
      timeout: TIMEOUT_MS,
      signal,
    }),
  );
  return toPage(res.data, toFolder);
}

async function getFolder(id: number, signal?: AbortSignal): Promise<WorkbookFolder> {
  const res = await call<{ data: ApiFolder }>(() =>
    axios.get(`${BASE}/workbook-folders/${id}`, { headers: headers(), timeout: TIMEOUT_MS, signal }),
  );
  return toFolder(res.data);
}

async function createFolder(storeCode: string | null | undefined, payload: CreateFolderPayload): Promise<WorkbookFolder> {
  const store = requireStore(storeCode);
  const res = await call<{ data: ApiFolder }>(() =>
    axios.post(`${BASE}/stores/${store}/workbook-folders`, payload, { headers: headers(), timeout: TIMEOUT_MS }),
  );
  return toFolder(res.data);
}

async function updateFolder(id: number, payload: UpdateFolderPayload): Promise<WorkbookFolder> {
  const res = await call<{ data: ApiFolder }>(() =>
    axios.post(`${BASE}/workbook-folders/${id}`, payload, { headers: headers(), timeout: TIMEOUT_MS }),
  );
  return toFolder(res.data);
}

async function setFolderVisibility(id: number, payload: VisibilityPayload): Promise<WorkbookFolder> {
  const res = await call<{ data: ApiFolder }>(() =>
    axios.post(`${BASE}/workbook-folders/${id}/visibility`, payload, { headers: headers(), timeout: TIMEOUT_MS }),
  );
  return toFolder(res.data);
}

/** A non-empty folder answers 409 WORKBOOK_FOLDER_NOT_EMPTY unless `force`. */
async function deleteFolder(id: number, opts: { force?: boolean } = {}): Promise<void> {
  await call(() =>
    axios.delete(`${BASE}/workbook-folders/${id}`, {
      headers: headers(),
      params: opts.force ? { force: "true" } : undefined,
      timeout: TIMEOUT_MS,
    }),
  );
}

/* ── Workbooks ───────────────────────────────────────────────────────────── */

async function listWorkbooks(
  folderId: number,
  q: WorkbookListQuery,
  signal?: AbortSignal,
): Promise<Page<Workbook>> {
  const params: Record<string, string | number> = {};
  if (q.search?.trim()) params.search = q.search.trim();
  if (q.sortBy) params.sort_by = q.sortBy;
  if (q.sortOrder) params.sort_order = q.sortOrder;
  if (q.perPage) params.per_page = q.perPage;
  if (q.page) params.page = q.page;
  const res = await call<{ data: ApiPaginator<ApiWorkbook> }>(() =>
    axios.get(`${BASE}/workbook-folders/${folderId}/workbooks`, {
      headers: headers(),
      params,
      timeout: TIMEOUT_MS,
      signal,
    }),
  );
  return toPage(res.data, toWorkbook);
}

async function getWorkbook(id: number, signal?: AbortSignal): Promise<Workbook> {
  const res = await call<{ data: ApiWorkbook }>(() =>
    axios.get(`${BASE}/workbooks/${id}`, { headers: headers(), timeout: TIMEOUT_MS, signal }),
  );
  return toWorkbook(res.data);
}

async function createWorkbook(
  storeCode: string | null | undefined,
  folderId: number,
  payload: CreateWorkbookPayload,
): Promise<Workbook> {
  const store = requireStore(storeCode);
  const res = await call<{ data: ApiWorkbook }>(() =>
    axios.post(`${BASE}/stores/${store}/workbook-folders/${folderId}/workbooks`, payload, {
      headers: headers(),
      timeout: TIMEOUT_MS,
    }),
  );
  return toWorkbook(res.data);
}

async function updateWorkbook(id: number, payload: UpdateWorkbookPayload): Promise<Workbook> {
  const res = await call<{ data: ApiWorkbook }>(() =>
    axios.post(`${BASE}/workbooks/${id}`, payload, { headers: headers(), timeout: TIMEOUT_MS }),
  );
  return toWorkbook(res.data);
}

async function setWorkbookVisibility(id: number, payload: VisibilityPayload): Promise<Workbook> {
  const res = await call<{ data: ApiWorkbook }>(() =>
    axios.post(`${BASE}/workbooks/${id}/visibility`, payload, { headers: headers(), timeout: TIMEOUT_MS }),
  );
  return toWorkbook(res.data);
}

async function deleteWorkbook(id: number): Promise<void> {
  await call(() => axios.delete(`${BASE}/workbooks/${id}`, { headers: headers(), timeout: TIMEOUT_MS }));
}

/* ── Columns ─────────────────────────────────────────────────────────────── */

/**
 * WHOLE-LIST replace: array order is display order, an `id` keeps a column,
 * no `id` adds one, and an omitted column is DELETED with its cells.
 */
async function replaceColumns(workbookId: number, columns: ColumnDraftPayload[]): Promise<WorkbookColumn[]> {
  const res = await call<{ data: ApiColumn[] | ApiWorkbook | { data: ApiColumn[] } }>(() =>
    axios.post(`${BASE}/workbooks/${workbookId}/columns`, { columns }, { headers: headers(), timeout: TIMEOUT_MS }),
  );
  // Accept a bare list, a workbook, or a nested list — whichever the endpoint sends.
  const body = res.data as unknown;
  const list: ApiColumn[] = Array.isArray(body)
    ? body
    : Array.isArray((body as ApiWorkbook)?.columns)
      ? (body as ApiWorkbook).columns!
      : Array.isArray((body as { data?: ApiColumn[] })?.data)
        ? (body as { data: ApiColumn[] }).data
        : [];
  return list.map(toColumn).sort((a, b) => a.position - b.position);
}

/* ── Rows ────────────────────────────────────────────────────────────────── */

function rowParams(q: RowsQuery): Record<string, string | number> {
  const p: Record<string, string | number> = { page: q.page, per_page: q.perPage };
  if (q.search?.trim()) p.search = q.search.trim();
  for (const [columnId, value] of Object.entries(q.filters)) {
    if (value !== "" && value != null) p[`filter[${columnId}]`] = value;
  }
  if (q.sortColumn != null) {
    p.sort_column = q.sortColumn;
    p.sort_order = q.sortOrder ?? "asc";
  }
  return p;
}

async function listRows(workbookId: number, q: RowsQuery, signal?: AbortSignal): Promise<Page<WorkbookRow>> {
  const res = await call<{ data: ApiPaginator<ApiRow> }>(() =>
    axios.get(`${BASE}/workbooks/${workbookId}/rows`, {
      headers: headers(),
      params: rowParams(q),
      timeout: TIMEOUT_MS,
      signal,
    }),
  );
  return toPage(res.data, toRow);
}

async function createRow(
  storeCode: string | null | undefined,
  workbookId: number,
  payload: RowPayload,
): Promise<WorkbookRow> {
  const store = requireStore(storeCode);
  const res = await call<{ data: ApiRow }>(() =>
    axios.post(`${BASE}/stores/${store}/workbooks/${workbookId}/rows`, payload, {
      headers: headers(),
      timeout: TIMEOUT_MS,
    }),
  );
  return toRow(res.data);
}

/** Partial — only the cells named are touched. */
async function updateRow(workbookId: number, rowId: number, payload: RowPayload): Promise<WorkbookRow> {
  const res = await call<{ data: ApiRow }>(() =>
    axios.post(`${BASE}/workbooks/${workbookId}/rows/${rowId}`, payload, { headers: headers(), timeout: TIMEOUT_MS }),
  );
  return toRow(res.data);
}

async function setRowVisibility(workbookId: number, rowId: number, payload: VisibilityPayload): Promise<WorkbookRow> {
  const res = await call<{ data: ApiRow }>(() =>
    axios.post(`${BASE}/workbooks/${workbookId}/rows/${rowId}/visibility`, payload, {
      headers: headers(),
      timeout: TIMEOUT_MS,
    }),
  );
  return toRow(res.data);
}

async function reorderRows(workbookId: number, rowIds: number[]): Promise<void> {
  await call(() =>
    axios.post(`${BASE}/workbooks/${workbookId}/rows/reorder`, { row_ids: rowIds }, {
      headers: headers(),
      timeout: TIMEOUT_MS,
    }),
  );
}

async function deleteRow(workbookId: number, rowId: number): Promise<void> {
  await call(() =>
    axios.delete(`${BASE}/workbooks/${workbookId}/rows/${rowId}`, { headers: headers(), timeout: TIMEOUT_MS }),
  );
}

export const workbooksService = {
  getOptions,
  listFolders,
  getFolder,
  createFolder,
  updateFolder,
  setFolderVisibility,
  deleteFolder,
  listWorkbooks,
  getWorkbook,
  createWorkbook,
  updateWorkbook,
  setWorkbookVisibility,
  deleteWorkbook,
  replaceColumns,
  listRows,
  createRow,
  updateRow,
  setRowVisibility,
  reorderRows,
  deleteRow,
};
