/* ────────────────────────────────────────────────────────────────────────── */
/*  Workbooks (ToolboxPizza)                                                 */
/*                                                                            */
/*  Folder ──nests──▶ Folder ──▶ Workbook ──▶ Column (shape) + Row (data)     */
/*                                                                            */
/*  Api* types are the wire shapes (snake_case). The app shapes below them    */
/*  are what components consume. Visibility values and labels are NEVER      */
/*  hard-coded — they come from GET /workbook-options.                        */
/* ────────────────────────────────────────────────────────────────────────── */

/** Kept as `string`, not a union: the catalogue is the source of truth. */
export type VisibilityValue = string;
export type ColumnType = "text" | "long_text" | "number" | "date" | "boolean" | "select";
export type CellValue = string | boolean | null;

/* ── Wire shapes ─────────────────────────────────────────────────────────── */

export interface ApiVisibilityOption {
  value: string;
  label: string;
  audience: number;
  audience_label: string;
  grants_edit: boolean;
  needs_roles: boolean;
}

export interface ApiColumnTypeOption {
  value: string;
  label: string;
  needs_options: boolean;
}

export interface ApiCappedBy {
  type: "folder" | "workbook" | string;
  id: number;
  visibility: string;
  visibility_label?: string;
}

export interface ApiEffectiveVisibility {
  can_view: boolean;
  can_edit: boolean;
  capped_by?: ApiCappedBy | null;
}

export interface ApiStoreRef {
  id: number;
  store_number: string;
  name: string;
}

export interface ApiUserRef {
  id: number;
  name: string;
}

export interface ApiBreadcrumb {
  id: number;
  name: string;
}

export interface ApiViewerCan {
  view?: boolean;
  edit?: boolean;
  manage_columns?: boolean;
  add_rows?: boolean;
  change_visibility?: boolean;
  delete?: boolean;
}

export interface ApiFolder {
  id: number;
  parent_id: number | null;
  name: string;
  description: string | null;
  store?: ApiStoreRef | null;
  created_by?: ApiUserRef | null;
  visibility: string;
  visibility_label: string;
  visibility_roles: string[] | null;
  effective_visibility?: ApiEffectiveVisibility | null;
  workbooks_count?: number;
  children_count?: number;
  breadcrumb?: ApiBreadcrumb[];
  created_at: string;
  updated_at: string;
  viewer?: { can: ApiViewerCan };
}

export interface ApiColumn {
  id: number;
  name: string;
  type: string;
  type_label?: string;
  options: string[] | null;
  required: boolean;
  position: number;
}

export interface ApiWorkbook {
  id: number;
  folder_id: number;
  name: string;
  description: string | null;
  store?: ApiStoreRef | null;
  created_by?: ApiUserRef | null;
  visibility: string;
  visibility_label: string;
  visibility_roles: string[] | null;
  effective_visibility?: ApiEffectiveVisibility | null;
  columns?: ApiColumn[];
  breadcrumb?: ApiBreadcrumb[];
  rows_count?: number;
  created_at: string;
  updated_at: string;
  viewer?: { can: ApiViewerCan };
}

export interface ApiRow {
  id: number;
  workbook_id: number;
  position: number;
  store?: ApiStoreRef | null;
  created_by?: ApiUserRef | null;
  visibility: string;
  visibility_label: string;
  visibility_roles: string[] | null;
  cells: Record<string, CellValue>;
  created_at: string;
  updated_at: string;
  viewer?: { can: ApiViewerCan };
}

/** Laravel paginator: items at `data`, pager fields flat beside them. No `meta`. */
export interface ApiPaginator<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  from: number | null;
  to: number | null;
  total: number;
}

/* ── App shapes ──────────────────────────────────────────────────────────── */

export interface VisibilityOption {
  value: string;
  label: string;
  audience: number;
  audienceLabel: string;
  grantsEdit: boolean;
  needsRoles: boolean;
}

export interface ColumnTypeOption {
  value: string;
  label: string;
  needsOptions: boolean;
}

export interface WorkbookOptions {
  visibilities: VisibilityOption[];
  columnTypes: ColumnTypeOption[];
  /** True when the proxy is answering from the in-memory demo (TOOLBOX_MOCK). */
  demo: boolean;
}

export interface CappedBy {
  type: string;
  id: number;
  visibility: string;
  visibilityLabel: string | null;
}

export interface EffectiveVisibility {
  canView: boolean;
  canEdit: boolean;
  cappedBy: CappedBy | null;
}

export interface StoreRef {
  id: number;
  storeNumber: string;
  name: string;
}

export interface UserRef {
  id: number;
  name: string;
}

export interface Breadcrumb {
  id: number;
  name: string;
}

/** Render controls from this. Never re-derive the tag rules on the client. */
export interface ViewerCan {
  view: boolean;
  edit: boolean;
  manageColumns: boolean;
  addRows: boolean;
  changeVisibility: boolean;
  delete: boolean;
}

/** The fields every tagged item (folder, workbook, row) shares. */
export interface Tagged {
  visibility: string;
  visibilityLabel: string;
  /** Always an array for a role tag, always null otherwise. */
  visibilityRoles: string[] | null;
}

export interface WorkbookFolder extends Tagged {
  id: number;
  parentId: number | null;
  name: string;
  description: string | null;
  store: StoreRef | null;
  createdBy: UserRef | null;
  effective: EffectiveVisibility | null;
  /** Counts only workbooks THIS caller can open. */
  workbooksCount: number | null;
  childrenCount: number | null;
  breadcrumb: Breadcrumb[];
  createdAt: string;
  updatedAt: string;
  can: ViewerCan;
}

export interface WorkbookColumn {
  id: number;
  name: string;
  type: ColumnType | string;
  typeLabel: string | null;
  options: string[] | null;
  required: boolean;
  position: number;
}

export interface Workbook extends Tagged {
  id: number;
  folderId: number;
  name: string;
  description: string | null;
  store: StoreRef | null;
  createdBy: UserRef | null;
  effective: EffectiveVisibility | null;
  columns: WorkbookColumn[];
  breadcrumb: Breadcrumb[];
  rowsCount: number | null;
  createdAt: string;
  updatedAt: string;
  can: ViewerCan;
}

export interface WorkbookRow extends Tagged {
  id: number;
  workbookId: number;
  position: number;
  store: StoreRef | null;
  createdBy: UserRef | null;
  /** A key for EVERY column, null where blank. */
  cells: Record<string, CellValue>;
  createdAt: string;
  updatedAt: string;
  can: ViewerCan;
}

export interface Page<T> {
  items: T[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  from: number | null;
  to: number | null;
  total: number;
}

/* ── Queries & payloads ──────────────────────────────────────────────────── */

export interface FolderListQuery {
  /** undefined = whole tree flat, null = roots only, number = children of. */
  parentId?: number | null;
  search?: string;
  sortBy?: "name" | "created_at" | "workbooks_count";
  sortOrder?: "asc" | "desc";
  perPage?: number;
  page?: number;
}

export interface WorkbookListQuery {
  search?: string;
  sortBy?: "name" | "created_at";
  sortOrder?: "asc" | "desc";
  perPage?: number;
  page?: number;
}

export interface RowsQuery {
  search?: string;
  /** columnId → raw filter value. Empty values are dropped before sending. */
  filters: Record<string, string>;
  sortColumn?: number | null;
  sortOrder?: "asc" | "desc";
  page: number;
  perPage: number;
}

export interface VisibilityPayload {
  visibility: string;
  visibility_roles?: string[];
}

export interface CreateFolderPayload extends VisibilityPayload {
  name: string;
  description?: string | null;
  parent_id: number | null;
}

export interface UpdateFolderPayload extends Partial<VisibilityPayload> {
  name?: string;
  description?: string | null;
  parent_id?: number | null;
}

export interface ColumnDraftPayload {
  id?: number;
  name: string;
  type?: string;
  required?: boolean;
  options?: string[];
}

export interface CreateWorkbookPayload extends VisibilityPayload {
  name: string;
  description?: string | null;
  columns: ColumnDraftPayload[];
}

export interface UpdateWorkbookPayload extends Partial<VisibilityPayload> {
  name?: string;
  description?: string | null;
}

export interface RowPayload extends Partial<VisibilityPayload> {
  cells: Record<string, string | null>;
}

/* ── Errors ──────────────────────────────────────────────────────────────── */

export type WorkbooksErrorCode =
  | "NO_STORE"
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "CANCELLED"
  | "UNKNOWN";

/** What stores keep and error cards render. */
export interface WorkbooksErrorState {
  message: string;
  code: WorkbooksErrorCode;
  serverCode: string | null;
  retryable: boolean;
  cappedBy: CappedBy | null;
}
