/* ────────────────────────────────────────────────────────────────────────── */
/*  Data Management – Due Keys API Types                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export type DueKeyDataType = "text" | "number" | "decimal" | "boolean" | "json";

// ── Raw API types (snake_case) ─────────────────────────────────────────

export interface ApiDueKeyTagPivot {
  entered_key_id: number;
  tag_id: number;
}

export interface ApiDueKeyTag {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
  pivot?: ApiDueKeyTagPivot;
}

export interface ApiDueKeyAttachment {
  id: number;
  entered_key_value_id: number;
  file_path: string;
  disk: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
  updated_at: string;
  attachment_url: string;
}

export interface ApiDueKeyValue {
  id: number;
  key_id: number;
  store_id: string;
  user_id: number;
  entry_date: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_json: unknown;
  created_at: string;
  updated_at: string;
  note: string | null;
  attachments: ApiDueKeyAttachment[];
}

export interface ApiDueKeyItem {
  key_id: number;
  label: string;
  data_type: DueKeyDataType;
  frequency_type?: string;
  interval?: number;
  mode?: string;
  fill_mode?: string;
  filled: boolean;
  value: ApiDueKeyValue | null;
  tags?: ApiDueKeyTag[];
}

export interface ApiEmployee {
  id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  store_id: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ApiDueKeysResponse {
  store_id: string;
  date: string;
  items: ApiDueKeyItem[];
  employees?: ApiEmployee[];
}

// ── Frontend types (camelCase) ─────────────────────────────────────────

export interface DueKeyTagPivot {
  enteredKeyId: number;
  tagId: number;
}

export interface DueKeyTag {
  id: number;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  pivot?: DueKeyTagPivot;
}

export interface DueKeyAttachment {
  id: number;
  enteredKeyValueId: number;
  filePath: string;
  originalName: string;
  mimeType: string;
  size: number;
  attachmentUrl: string;
}

export interface DueKeyValue {
  id: number;
  keyId: number;
  storeId: string;
  userId: number;
  entryDate: string;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueJson: unknown;
  createdAt: string;
  updatedAt: string;
  note: string | null;
  attachments: DueKeyAttachment[];
}

export interface DueKeyItem {
  keyId: number;
  label: string;
  dataType: DueKeyDataType;
  filled: boolean;
  value: DueKeyValue | null;
  tags: DueKeyTag[];
}

export interface Employee {
  id: number;
  firstName: string;
  middleName: string | null;
  lastName: string;
  storeId: string;
  active: boolean;
}

export interface DueKeysResponse {
  storeId: string;
  date: string;
  items: DueKeyItem[];
  employees: Employee[];
}

/** Actual response shape from GET /engine/stores/{id}/due-range */
export interface ApiDueRangeResponse {
  store_id: string;
  from: string;
  to: string;
  /** Keys are YYYY-MM-DD date strings, values are arrays of key items for that day */
  days: Record<string, ApiDueKeyItem[]>;
}

/** Transformed frontend type for a range entry */
export interface DueRangeEntry {
  date: string;
  items: DueKeyItem[];
  /** Empty — range endpoint does not return employee records */
  employees: Employee[];
}

// ── Payloads (snake_case — sent to API) ────────────────────────────────

export interface DueKeyValuePayload {
  key_id: number;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_json: unknown;
  note?: string | null;
  /** Files to attach. Only used in multipart/form-data requests (single-key endpoint). */
  attachments?: File[] | null;
}
