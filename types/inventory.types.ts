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

/**
 * A trilingual item tag/category, as returned on `Item`/`EntryItemItem`.
 * Unrelated to the flat single-language `Tag` in `types/tag.types.ts` (a
 * different feature, backed by a separate `/tags` endpoint) — kept as its
 * own type so the two never get confused.
 */
export interface ItemTag {
  id: number;
  name_en: string;
  name_ar: string;
  name_es: string;
}

/**
 * A tag as sent on item create/update. Matching is by `name_en` only — if it
 * matches an existing tag, that tag is reused and `name_ar`/`name_es` here are
 * ignored server-side; otherwise a new tag is created from all three names.
 */
export interface ItemTagInput {
  name_en: string;
  name_ar: string;
  name_es: string;
}

/** A tag as shown on the public (no-auth) counting link — single, pre-resolved language. */
export interface PublicItemTag {
  id: number;
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
  is_active: boolean;
  /** Present only when all_stores is false. */
  stores?: ItemStoreRef[];
  tags: ItemTag[];
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
  /** Required — at least one tag per item. */
  tags: ItemTagInput[];
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
  lang: "en" | "ar" | "es";
  status: LinkStatus;
  items_count: number;
  created_by: LinkCreatorRef;
  created_at: string;
}

export interface CreateLinkPayload {
  store_id: string;
  date: string;
  type: InventoryType;
  lang: "en" | "ar" | "es";
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
  /** Only present once the backend's tags feature is deployed — optional so older entries don't break. */
  tags?: ItemTag[];
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
  /** Only entries with at least one counted item carrying this tag. */
  tag_id?: number;
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
  /** Single localised name — language chosen by the link's `lang`. */
  name: string;
  /** Single localised detail text, or null when not set. */
  details: string | null;
  image: string | null;
  unit_1: { name: string | null };
  /** Null for single-unit items. */
  unit_2: { name: string | null } | null;
  unit_2_per_unit_1: string | null;
  unit_3: { name: string | null } | null;
  unit_3_per_unit_2: string | null;
  /** Empty array = uncategorized. */
  tags: PublicItemTag[];
}

/** The public form payload returned by GET /public/inventory/{token}. */
export interface PublicLink {
  user_name: string;
  lang: "en" | "ar" | "es";
  store: { name: string };
  date: string;
  type: InventoryType;
  items: PublicLinkItem[];
}

/** One item's counts in a public submission. */
export interface PublicSubmitItem {
  item_id: number;
  count_unit_1: number;
  count_unit_2?: number;
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

export interface ItemListParams extends ListParams {
  /** true = only active items; false = only inactive; omit = all. */
  active?: boolean;
  /** Free-text search against name/ultimatrix_id. */
  search?: string;
  /** Filter to items whose `types` array includes this value. */
  type?: InventoryType;
}
