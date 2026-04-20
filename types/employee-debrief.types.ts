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

export interface ApiEmployeeDebriefItem {
  id: number;
  employee_id?: number | null;
  employee_name?: string | null;
  employee?: ApiEmployeeObject | null;
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
  employee_id?: number | null;
  employee_name?: string | null;
  employee?: ApiEmployeeObject | null;
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

// ── Frontend types (camelCase) ─────────────────────────────────────────

export interface EmployeeDebriefItem {
  id: number;
  employeeId?: number | null;
  employeeName?: string | null;
  storeId?: string | null;
  date?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  notes?: string | null;
}

export interface EmployeeDebriefDetail {
  id: number;
  employeeId?: number | null;
  employeeName?: string | null;
  storeId?: string | null;
  date?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  notes?: string | null;
  content?: string | null;
  summary?: string | null;
}
