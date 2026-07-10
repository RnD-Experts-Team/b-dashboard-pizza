/**
 * TypeScript types for the Inventory feature.
 *
 * Shapes mirror API_ENDPOINTS.md exactly. The API uses snake_case; we keep the
 * snake_case field names here (no camel transform) because the inventory payloads
 * are already flat and simple, which keeps the form code 1:1 with the API docs.
 */

/** The inventory item "type" — controls which links/items apply. */
export type InventoryType = "daily" | "weekly" | "period";

/** Entry / link status values returned by the API. */
export type LinkStatus = "active" | "submitted" | "expired";
export type EntryStatus = "submitted";

/* ── Units ─────────────────────────────────────────────────────────────── */
export interface Unit {
  id: number;
  name: string;
  items_count?: number;
}

export interface UnitPayload {
  name: string;
}

/* ── Items ─────────────────────────────────────────────────────────────── */
/** A minimal store reference embedded in an item (only when all_stores=false). */
export interface ItemStoreRef {
  id: string;
  /** Human-readable store number (e.g. "03795-00001"). Present on item.stores;
   *  the external key used to identify a store on create/update. */
  store_number?: string;
  name: string;
}

export interface Item {
  id: number;
  ultimatrix_id: string;
  name_en: string;
  name_ar: string;
  name_es: string;
  details_en: string | null;
  details_ar: string | null;
  details_es: string | null;
  /** Full image URL (already rewritten to the same-origin /inventory-storage path) or null. */
  image: string | null;
  unit_1: Unit | null;
  unit_2: Unit | null;
  unit_2_per_unit_1: string | null;
  unit_3: Unit | null;
  unit_3_per_unit_2: string | null;
  types: InventoryType[];
  all_stores: boolean;
  /** Present only when all_stores is false. */
  stores?: ItemStoreRef[];
}

/**
 * Fields used to build the multipart/form-data body for create/update.
 * Strings keep the form simple; the service converts them to FormData.
 */
export interface ItemFormValues {
  ultimatrix_id: string;
  name_en: string;
  name_ar: string;
  name_es: string;
  details_en: string;
  details_ar: string;
  details_es: string;
  unit_1_id: string;
  unit_2_id: string;
  unit_2_per_unit_1: string;
  unit_3_id: string; // "" means no third unit
  unit_3_per_unit_2: string;
  types: InventoryType[];
  all_stores: boolean;
  store_ids: string[]; // required when all_stores is false
  /** A newly selected file, or null to leave the existing image untouched. */
  image: File | null;
}

/* ── Links ─────────────────────────────────────────────────────────────── */
export interface LinkEmployeeRef {
  id: number;
  name: string;
  store_id: string;
}

export interface LinkCreatorRef {
  id: number;
  name: string;
}

export interface Link {
  id: number;
  token: string;
  url: string;
  employee: LinkEmployeeRef;
  store: ItemStoreRef;
  date: string;
  type: InventoryType;
  status: LinkStatus;
  items_count: number;
  created_by: LinkCreatorRef;
  created_at: string;
}

export interface CreateLinkPayload {
  store_id: string;
  date: string;
  type: InventoryType;
  employee_ids: number[];
}

/* ── Entries ───────────────────────────────────────────────────────────── */
export interface Entry {
  id: number;
  reference: string;
  submitted_by: string;
  store: ItemStoreRef;
  date: string;
  type: InventoryType;
  status: EntryStatus;
  items_count: number;
  edited_items_count: number;
  submitted_at: string;
}

/** One recount edit in the append-only history. */
export interface EntryItemEdit {
  id: number;
  prev_count_unit_1: string;
  prev_count_unit_2: string;
  prev_count_unit_3: string;
  prev_total: string;
  new_count_unit_1: string;
  new_count_unit_2: string;
  new_count_unit_3: string;
  new_total: string;
  reason: string;
  edited_by: LinkCreatorRef;
  edited_at: string;
}

/** The item snapshot embedded in an entry item. */
export interface EntryItemItem {
  id: number;
  ultimatrix_id: string;
  name_en: string;
  name_ar: string;
  name_es: string;
  unit_1: Unit | null;
  unit_2: Unit | null;
  unit_2_per_unit_1: string | null;
  unit_3: Unit | null;
  unit_3_per_unit_2: string | null;
}

export interface EntryItem {
  id: number;
  item: EntryItemItem;
  count_unit_1: string;
  count_unit_2: string;
  count_unit_3: string;
  total_in_unit_1: string;
  /**
   * Only present when the entry was fetched via `GET /inventory/entries/{id}/history`
   * (requires the history permission) — never via the plain `/inventory/entries/{id}`.
   * The endpoint choice is now deterministic (see `useEntryDetail`), not detected
   * per-field, but these stay optional since a basic-fetched item never has them.
   */
  is_edited?: boolean;
  edits?: EntryItemEdit[];
}

/** Full entry detail = Entry + the items array. */
export interface EntryDetail extends Entry {
  items: EntryItem[];
}

/* ── List filters ──────────────────────────────────────────────────────── */
export interface EntryListParams extends ListParams {
  date_from?: string;
  date_to?: string;
  type?: InventoryType;
  /** LIKE search on the submitter's name snapshot. */
  submitted_by?: string;
  /** true = only entries with at least one edited item; false = only entries with none. */
  edited?: boolean;
}

export interface LinkListParams extends ListParams {
  date_from?: string;
  date_to?: string;
  type?: InventoryType;
  /** Only "active" | "submitted" are valid filter values (unlike the full LinkStatus). */
  status?: "active" | "submitted";
  employee_id?: number;
}

export interface UpdateEntryItemPayload {
  count_unit_1: number;
  count_unit_2: number;
  count_unit_3?: number;
  reason: string;
}

/* ── Public link (no-auth submission form) ─────────────────────────────── */
/** One item shown on the public count form (unit objects carry only a name). */
export interface PublicLinkItem {
  id: number;
  ultimatrix_id: string;
  name_en: string;
  name_ar: string;
  name_es: string;
  details_en: string | null;
  details_ar: string | null;
  details_es: string | null;
  image: string | null;
  unit_1: { name: string | null };
  unit_2: { name: string | null };
  unit_2_per_unit_1: string | null;
  unit_3: { name: string | null } | null;
  unit_3_per_unit_2: string | null;
}

/** The public form payload returned by GET /public/inventory/{token}. */
export interface PublicLink {
  user_name: string;
  store: { name: string };
  date: string;
  type: InventoryType;
  items: PublicLinkItem[];
}

/** One item's counts in a public submission. */
export interface PublicSubmitItem {
  item_id: number;
  count_unit_1: number;
  count_unit_2: number;
  count_unit_3?: number;
}

/** Response from POST /public/inventory/{token}/submit. */
export interface PublicSubmitResponse {
  reference: string;
  submitted_at: string;
}

/* ── Shared list params ────────────────────────────────────────────────── */
export interface ListParams {
  page?: number;
  perPage?: number;
}
