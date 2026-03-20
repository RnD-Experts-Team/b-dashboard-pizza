/* ────────────────────────────────────────────────────────────────────────── */
/*  Quality Assurance (QA) API Types                                        */
/* ────────────────────────────────────────────────────────────────────────── */

// ── Raw API types (snake_case) ─────────────────────────────────────────

export interface ApiQAStore {
  id: number;
  store: string;
  group: number;
  created_at: string;
  updated_at: string;
}

export interface ApiQAUser {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface ApiQAAudit {
  id: number;
  store_id: number;
  user_id: number;
  date: string;
  created_at: string;
  updated_at: string;
  store: ApiQAStore;
  user: ApiQAUser;
}

export interface ApiQAPaginationLink {
  url: string | null;
  label: string;
  active: boolean;
}

export interface ApiQAPaginatedData {
  current_page: number;
  data: ApiQAAudit[];
  first_page_url: string;
  from: number | null;
  last_page: number;
  last_page_url: string;
  links: ApiQAPaginationLink[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
}

export interface ApiQAAuditsResponse {
  status: string;
  message: string;
  data: ApiQAPaginatedData;
  errors: unknown;
}

export interface ApiQARatingsSummaryItem {
  entity_id: number;
  entity_label: string;
  auto_fail_count: number;
  urgent_count: number;
  total_count: number;
}

export interface ApiQARatingsSummaryResponse {
  status: string;
  message: string;
  data: ApiQARatingsSummaryItem[];
  errors: unknown;
}

// ── Frontend types (camelCase) ─────────────────────────────────────────

export interface QAStore {
  id: number;
  store: string;
  group: number;
  createdAt: string;
  updatedAt: string;
}

export interface QAUser {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface QAAudit {
  id: number;
  storeId: number;
  userId: number;
  date: string;
  createdAt: string;
  updatedAt: string;
  store: QAStore;
  user: QAUser;
}

export interface QAPaginationInfo {
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
  from: number | null;
  to: number | null;
}

export interface QAAuditsResponse {
  audits: QAAudit[];
  pagination: QAPaginationInfo;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface QARatingsSummaryItem {
  entityId: number;
  entityLabel: string;
  autoFailCount: number;
  urgentCount: number;
  totalCount: number;
}

export interface QAErrorState {
  message: string;
  code: string;
  retryable: boolean;
}

// ── QA Category types ──────────────────────────────────────────────────

export interface ApiQACategory {
  id: number;
  label: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ApiQACategoryCreateResponse {
  status: string;
  message: string;
  data: ApiQACategory;
}

export interface QACategory {
  id: number;
  label: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQACategoryPayload {
  label: string;
  sort_order?: number;
}

export interface UpdateQACategoryPayload {
  label: string;
  sort_order?: number;
}

// ── QA Entity types ────────────────────────────────────────────────────

export interface ApiQAEntity {
  id: number;
  entity_label: string;
  category_id: number;
  date_range_type: string;
  report_type: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiQAEntityCreateResponse {
  status: string;
  message: string;
  data: ApiQAEntity;
}

export interface QAEntity {
  id: number;
  entityLabel: string;
  categoryId: number;
  dateRangeType: string;
  reportType: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQAEntityPayload {
  entity_label: string;
  category_id?: number;
  date_range_type: "daily" | "weekly";
  report_type?: string | null;
  sort_order?: number;
  active: boolean;
}

export interface UpdateQAEntityPayload {
  entity_label: string;
  category_id?: number;
  date_range_type: "daily" | "weekly";
  report_type?: string | null;
  sort_order?: number;
  active: boolean;
}

// ── QA Entities List response (includes categories) ────────────────────

export interface ApiQAEntityListCategory {
  id: number;
  label: string;
  sort_order: number;
  entities_count?: number;
  created_at: string;
  updated_at: string;
}

/** Entity returned by GET /entities — includes nested category */
export interface ApiQAEntityWithCategory extends ApiQAEntity {
  category?: ApiQAEntityListCategory;
}

export interface ApiQAEntitiesListResponse {
  status: string;
  message: string;
  data: {
    entities: ApiQAEntityWithCategory[];
    categories: ApiQAEntityListCategory[];
  };
  errors: unknown;
}

export interface QAEntityListCategory {
  id: number;
  label: string;
  sortOrder: number;
  entitiesCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Frontend entity with resolved category label */
export interface QAEntityWithCategory extends QAEntity {
  categoryLabel?: string;
}

/** Combined response for entities + categories */
export interface QAEntitiesAndCategories {
  entities: QAEntityWithCategory[];
  categories: QAEntityListCategory[];
}

// ── Camera Report types (raw API - snake_case) ────────────────────────

export interface ApiCameraReportRatingCount {
  rating_label: string;
  count: number;
}

export interface ApiCameraReportCategory {
  id: number;
  label: string;
  sort_order: number;
}

export interface ApiCameraReportEntity {
  entity_id: number;
  entity_label: string;
  rating_counts: ApiCameraReportRatingCount[];
  notes: string[];
  category: ApiCameraReportCategory;
}

export interface ApiCameraReportSummaryItem {
  store_id: number;
  store_name: string;
  store_group: number;
  entities: Record<string, ApiCameraReportEntity>;
}

export interface ApiCameraReportEntityDef {
  id: number;
  entity_label: string;
  category_id: number;
  date_range_type: string;
  report_type: string;
  sort_order: number;
  active: boolean;
  category: ApiCameraReportCategory;
}

export interface ApiCameraReportScoreData {
  score_without_auto_fail: number;
  score_with_auto_fail: number;
}

export interface ApiCameraReportStore {
  id: number;
  store: string;
  group: number;
}

export interface ApiCameraReportRating {
  id: number;
  label: string;
}

export interface ApiCameraReportFilters {
  store_id: number | null;
  group: number | null;
  report_type: string | null;
  date_from: string | null;
  date_to: string | null;
  rating_id: number | null;
  category_ids: number[] | null;
  date_range_type: "daily" | "weekly" | null;
}

export interface ApiCameraReportData {
  report: {
    summary: ApiCameraReportSummaryItem[];
    entities: ApiCameraReportEntityDef[];
    total_stores: number;
    scoreData: Record<string, ApiCameraReportScoreData>;
  };
  stores: ApiCameraReportStore[];
  groups: number[];
  ratings: ApiCameraReportRating[];
  filters: ApiCameraReportFilters;
}

export interface ApiCameraReportResponse {
  status: string;
  message: string;
  data: ApiCameraReportData;
  errors: unknown;
}

// ── Camera Report types (frontend - camelCase) ─────────────────────────

export interface CameraReportRatingCount {
  ratingLabel: string;
  count: number;
}

export interface CameraReportCategory {
  id: number;
  label: string;
  sortOrder: number;
}

export interface CameraReportEntity {
  entityId: number;
  entityLabel: string;
  ratingCounts: CameraReportRatingCount[];
  notes: string[];
  category: CameraReportCategory;
}

export interface CameraReportSummaryItem {
  storeId: number;
  storeName: string;
  storeGroup: number;
  entities: Record<string, CameraReportEntity>;
}

export interface CameraReportEntityDef {
  id: number;
  entityLabel: string;
  categoryId: number;
  dateRangeType: string;
  reportType: string;
  sortOrder: number;
  active: boolean;
  category: CameraReportCategory;
}

export interface CameraReportScoreData {
  scoreWithoutAutoFail: number;
  scoreWithAutoFail: number;
}

export interface CameraReportStore {
  id: number;
  store: string;
  group: number;
}

export interface CameraReportRating {
  id: number;
  label: string;
}

export interface CameraReportFilters {
  storeId: number | null;
  group: number | null;
  reportType: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  ratingId: number | null;
  categoryIds: number[] | null;
  dateRangeType: "daily" | "weekly" | null;
}

export interface CameraReportData {
  summary: CameraReportSummaryItem[];
  entities: CameraReportEntityDef[];
  totalStores: number;
  scoreData: Record<string, CameraReportScoreData>;
  stores: CameraReportStore[];
  groups: number[];
  ratings: CameraReportRating[];
  filters: CameraReportFilters;
}

// ── Camera Form List types (GET /camera-forms) ─────────────────────────

/** Raw API types for GET /camera-forms (snake_case) */

export interface ApiCameraFormAttachment {
  id: number;
  camera_form_note_id: number;
  path: string;
  url: string;
}

export interface ApiCameraFormNote {
  id: number;
  camera_form_id: number;
  note: string;
  attachments: ApiCameraFormAttachment[];
}

export interface ApiCameraFormEntityCategory {
  id: number;
  label: string;
  sort_order: number;
}

export interface ApiCameraFormEntityDef {
  id: number;
  entity_label: string;
  category: ApiCameraFormEntityCategory;
}

export interface ApiCameraFormRating {
  id: number;
  label: string;
}

export interface ApiCameraFormEntry {
  id: number;
  user_id: number;
  entity_id: number;
  audit_id: number;
  rating_id: number;
  entity: ApiCameraFormEntityDef;
  rating: ApiCameraFormRating;
  notes: ApiCameraFormNote[];
}

export interface ApiCameraFormStore {
  id: number;
  store: string;
  group: number;
}

export interface ApiCameraFormUser {
  id: number;
  name: string;
  email: string;
}

export interface ApiCameraFormAudit {
  id: number;
  store_id: number;
  user_id: number;
  date: string;
  created_at: string;
  updated_at: string;
  store: ApiCameraFormStore;
  user: ApiCameraFormUser;
  camera_forms: ApiCameraFormEntry[];
}

export interface ApiCameraFormsPaginatedData {
  current_page: number;
  data: ApiCameraFormAudit[];
  per_page: number;
  total: number;
  first_page_url?: string;
  from?: number | null;
  last_page?: number;
  last_page_url?: string;
  links?: ApiQAPaginationLink[];
  next_page_url?: string | null;
  path?: string;
  prev_page_url?: string | null;
  to?: number | null;
}

export interface ApiCameraFormsListResponse {
  status: string;
  message: string;
  data: ApiCameraFormsPaginatedData;
  errors: unknown;
}

/** Frontend types for GET /camera-forms (camelCase) */

export interface CameraFormAttachment {
  id: number;
  cameraFormNoteId: number;
  path: string;
  url: string;
}

export interface CameraFormNote {
  id: number;
  cameraFormId: number;
  note: string;
  attachments: CameraFormAttachment[];
}

export interface CameraFormEntityCategory {
  id: number;
  label: string;
  sortOrder: number;
}

export interface CameraFormEntityDef {
  id: number;
  entityLabel: string;
  category: CameraFormEntityCategory;
}

export interface CameraFormRatingInfo {
  id: number;
  label: string;
}

export interface CameraFormEntryItem {
  id: number;
  userId: number;
  entityId: number;
  auditId: number;
  ratingId: number;
  entity: CameraFormEntityDef;
  rating: CameraFormRatingInfo;
  notes: CameraFormNote[];
}

export interface CameraFormStore {
  id: number;
  store: string;
  group: number;
}

export interface CameraFormUser {
  id: number;
  name: string;
  email: string;
}

export interface CameraFormAudit {
  id: number;
  storeId: number;
  userId: number;
  date: string;
  createdAt: string;
  updatedAt: string;
  store: CameraFormStore;
  user: CameraFormUser;
  cameraForms: CameraFormEntryItem[];
}

export interface CameraFormsListResponse {
  audits: CameraFormAudit[];
  pagination: QAPaginationInfo;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface CameraFormsFilterParams {
  page?: number;
  dateRangeType?: "daily" | "weekly";
  dateFrom?: string;
  dateTo?: string;
  storeId?: number;
}

// ── Camera Form Create types ────────────────────────────────────────

/** Single entity rating entry for the camera form submission */
export interface CameraFormEntityEntry {
  entity_id: number;
  rating_id?: number;
  notes?: Array<{
    note?: string;
    images?: File[];
  }>;
}

/** Payload sent to POST /camera-forms */
export interface CreateCameraFormPayload {
  store_id: number;
  date: string;
  entities: CameraFormEntityEntry[];
}

/** Single entity rating entry for camera form update (supports edit-specific fields) */
export interface CameraFormUpdateEntityEntry {
  entity_id: number;
  rating_id?: number;
  notes?: Array<{
    id?: number;          // existing note id (to update)
    note?: string;
    images?: File[];      // new images
    remove_attachment_ids?: number[];   // attachments to remove
  }>;
  remove_note_ids?: number[];          // notes to remove entirely
}

/** Rating option for the camera form */
export interface CameraFormRating {
  id: number;
  label: string;
}

/** API response for camera form creation */
export interface ApiCameraFormCreateResponse {
  status: string;
  message: string;
  data: {
    id: number;
    store_id: number;
    user_id: number;
    date: string;
    created_at: string;
    updated_at: string;
    store: {
      id: number;
      store: string;
      group: number;
    };
    camera_forms: Array<{
      id: number;
      user_id: number;
      entity_id: number;
      audit_id: number;
      rating_id: number;
      notes: Array<{
        id: number;
        camera_form_id: number;
        note: string;
        attachments: Array<{
          id: number;
          camera_form_note_id: number;
          path: string;
          url: string;
        }>;
      }>;
    }>;
  };
  errors: unknown;
}
// ── Custom Report types ────────────────────────────────────────────────

/** Raw API custom report entity (snake_case) */
export interface ApiCustomReportEntity {
  id: number;
  entity_label?: string;
  label?: string;
  category_id?: number;
  date_range_type?: string;
  report_type?: string;
  sort_order?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
  category?: {
    id: number;
    label: string;
    sort_order?: number;
    created_at?: string;
    updated_at?: string;
  };
}

/** Raw API custom report (snake_case) */
export interface ApiCustomReport {
  id: number;
  name: string;
  entity_ids?: number[];
  entities_count?: number;
  created_by?: {
    id: number;
    name: string;
  } | null;
  entities?: ApiCustomReportEntity[];
  created_at?: string;
  updated_at?: string;
}

/** Raw API list response */
export interface ApiCustomReportsListResponse {
  status?: string;
  message?: string;
  data?: ApiCustomReport[];
  custom_reports?: ApiCustomReport[];
  errors?: unknown;
}

/** Raw API single detail response */
export interface ApiCustomReportDetailResponse {
  status?: string;
  message?: string;
  data?: ApiCustomReport;
  report?: ApiCustomReport;
  errors?: unknown;
}

/** Raw API create/update response */
export interface ApiCustomReportMutationResponse {
  status?: string;
  message?: string;
  data?: ApiCustomReport;
}

/** Frontend custom report entity (camelCase) */
export interface CustomReportEntity {
  id: number;
  entityLabel: string;
  categoryId: number;
  dateRangeType: string;
  reportType: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Frontend custom report (camelCase) */
export interface CustomReport {
  id: number;
  name: string;
  entityIds: number[];
  entitiesCount?: number;
  createdBy?: {
    id: number;
    name: string;
  } | null;
  entities?: CustomReportEntity[];
  createdAt: string;
  updatedAt: string;
}

/** Payload for create / update */
export interface CustomReportPayload {
  name: string;
  entity_ids: number[];
}