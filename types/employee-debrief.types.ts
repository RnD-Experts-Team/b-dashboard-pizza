/* ────────────────────────────────────────────────────────────────────────── */
/*  Data Management – Employee Debrief Notes API Types                      */
/* ────────────────────────────────────────────────────────────────────────── */

// ── Raw API types (snake_case) ─────────────────────────────────────────

export interface ApiEmployeeObject {
  id?: number | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  store_id?: string | null;
  active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ApiDebriefAuthor {
  id: number;
  name: string;
  email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ApiDebriefAttachment {
  id: number;
  employee_debrief_id?: number | null;
  file_path?: string | null;
  disk?: string | null;
  original_name?: string | null;
  mime_type?: string | null;
  size?: number | null;
  attachment_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ApiEmployeeDebriefItem {
  id: number;
  user_id?: number | null;
  employee_id?: number | null;
  employee_name?: string | null;
  employee?: ApiEmployeeObject | null;
  author?: ApiDebriefAuthor | null;
  attachments?: ApiDebriefAttachment[];
  store_id?: string | null;
  date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  note?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

export interface ApiEmployeeDebriefDetail {
  id: number;
  user_id?: number | null;
  employee_id?: number | null;
  employee_name?: string | null;
  employee?: ApiEmployeeObject | null;
  author?: ApiDebriefAuthor | null;
  attachments?: ApiDebriefAttachment[];
  store_id?: string | null;
  date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  note?: string | null;
  notes?: string | null;
  content?: string | null;
  summary?: string | null;
  [key: string]: unknown;
}

export interface ApiEmployeeDebriefListResponse {
  data?: ApiEmployeeDebriefItem[];
  results?: ApiEmployeeDebriefItem[];
  items?: ApiEmployeeDebriefItem[];
  count?: number;
  total?: number;
}

export interface ApiPaginatedDebriefResponse {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  data: ApiEmployeeDebriefItem[];
  first_page_url?: string | null;
  next_page_url?: string | null;
  prev_page_url?: string | null;
  from?: number | null;
  to?: number | null;
}

// ── Frontend types (camelCase) ─────────────────────────────────────────

export interface DebriefAttachment {
  id: number;
  filePath?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  attachmentUrl?: string | null;
}

export interface EmployeeDebriefItem {
  id: number;
  userId?: number | null;
  employeeId?: number | null;
  employeeName?: string | null;
  authorId?: number | null;
  authorName?: string | null;
  storeId?: string | null;
  date?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  notes?: string | null;
  attachments?: DebriefAttachment[];
}

export interface PaginatedDebriefResult {
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
  items: EmployeeDebriefItem[];
}

export interface EmployeeDebriefDetail {
  id: number;
  userId?: number | null;
  employeeId?: number | null;
  employeeName?: string | null;
  authorId?: number | null;
  authorName?: string | null;
  storeId?: string | null;
  date?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  notes?: string | null;
  content?: string | null;
  summary?: string | null;
  attachments?: DebriefAttachment[];
}
