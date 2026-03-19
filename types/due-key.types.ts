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

export interface ApiDueKeyItem {
  key_id: number;
  label: string;
  data_type: DueKeyDataType;
  filled: boolean;
  value: unknown;
  tags?: ApiDueKeyTag[];
}

export interface ApiDueKeysResponse {
  store_id: string;
  date: string;
  items: ApiDueKeyItem[];
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

export interface DueKeyItem {
  keyId: number;
  label: string;
  dataType: DueKeyDataType;
  filled: boolean;
  value: unknown;
  tags: DueKeyTag[];
}

export interface DueKeysResponse {
  storeId: string;
  date: string;
  items: DueKeyItem[];
}

// ── Payloads (snake_case — sent to API) ────────────────────────────────

export interface DueKeyValuePayload {
  key_id: number;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_json: unknown;
  note?: string | null;
}
