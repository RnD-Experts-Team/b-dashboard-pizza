/* ────────────────────────────────────────────────────────────────────────── */
/*  Data Management – Engine Keys API Types                                 */
/* ────────────────────────────────────────────────────────────────────────── */

// ── Enums / Unions ─────────────────────────────────────────────────────

export type KeyDataType = "text" | "number" | "decimal" | "boolean" | "json";

export type FrequencyType = "daily" | "weekly" | "monthly" | "yearly";

export type WeekOfMonth = 1 | 2 | 3 | 4 | -1;

export type FillMode = "store_once" | "role_each";

// ── Raw API types (snake_case) ─────────────────────────────────────────

export interface ApiStoreRule {
  id: number;
  store_id: string;
  frequency_type: FrequencyType;
  interval: number;
  week_days: number[] | null;
  month_day: number | null;
  week_of_month: WeekOfMonth | null;
  week_day: number | null;
  year_month: number | null;
  starts_at: string;
  ends_at: string | null;
  fill_mode: FillMode;
  role_names: string[] | null;
}

export interface ApiKey {
  id: number;
  label: string;
  data_type: KeyDataType;
  is_active: boolean;
  store_rules: ApiStoreRule[];
  created_at: string | null;
  updated_at: string | null;
}

export interface ApiKeysListResponse {
  data: ApiKey[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    path: string;
    per_page: number;
    to: number | null;
    total: number;
  };
}

// ── Frontend types (camelCase) ─────────────────────────────────────────

export interface StoreRule {
  id: number;
  storeId: string;
  frequencyType: FrequencyType;
  interval: number;
  weekDays: number[] | null;
  monthDay: number | null;
  weekOfMonth: WeekOfMonth | null;
  weekDay: number | null;
  yearMonth: number | null;
  startsAt: string;
  endsAt: string | null;
  fillMode: FillMode;
  roleNames: string[] | null;
}

export interface EngineKey {
  id: number;
  label: string;
  dataType: KeyDataType;
  isActive: boolean;
  storeRules: StoreRule[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface KeysPaginationInfo {
  currentPage: number;
  from: number | null;
  lastPage: number;
  perPage: number;
  to: number | null;
  total: number;
}

export interface KeysListResponse {
  data: EngineKey[];
  pagination: KeysPaginationInfo;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ── Payloads (snake_case — sent to API) ────────────────────────────────

export interface StoreRulePayload {
  store_id: string;
  frequency_type: FrequencyType;
  interval: number;
  week_days: number[] | null;
  month_day: number | null;
  week_of_month: WeekOfMonth | null;
  week_day: number | null;
  year_month: number | null;
  starts_at: string;
  ends_at: string | null;
  fill_mode: FillMode;
  role_names: string[] | null;
}

export interface CreateKeyPayload {
  label: string;
  data_type: KeyDataType;
  is_active: boolean;
  store_rules: StoreRulePayload[];
}

export interface UpdateKeyPayload {
  label: string;
  data_type: KeyDataType;
  is_active: boolean;
  store_rules: StoreRulePayload[];
}
