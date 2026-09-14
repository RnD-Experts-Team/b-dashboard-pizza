/* ────────────────────────────────────────────────────────────────────────── */
/*  Storage & Stock — locations, the movement ledger, and on-hand balances   */
/*                                                                            */
/*  ALL GLOBAL, not store-scoped. Note the absence of a storeId anywhere in   */
/*  these shapes — that is deliberate, not an omission.                      */
/*                                                                            */
/*  THE MENTAL MODEL EVERYTHING HERE SERVES:                                 */
/*                                                                            */
/*    On hand is SUM(quantity × direction) over every movement line,          */
/*    unfiltered. The ledger is APPEND-ONLY. A mistake is corrected by        */
/*    recording an equal-and-opposite REVERSAL, never by editing or deleting. */
/*    The `mistaken` flag is a DISPLAY MARKER with NO effect on arithmetic.   */
/*                                                                            */
/*  So a movement flagged mistaken still counts. Nothing in this feature may  */
/*  sum, count or filter in a way that excludes one.                         */
/*                                                                            */
/*  Conventions inherited from the rest of this backend:                     */
/*   - decimals arrive as STRINGS ("49.99"); the Api* mirrors say so          */
/*   - `null` = relation not loaded, `[]` = loaded and empty — never merge    */
/*   - enums arrive as { value, label }; filters take the bare value          */
/* ────────────────────────────────────────────────────────────────────────── */

import type {
  EnumField,
  LaravelPaginationLinks,
  LaravelPaginationMeta,
  TicketAttachment,
  TicketNote,
  UserRef,
  ApiTicketAttachment,
  ApiTicketNote,
} from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Enums                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Every movement type the ledger knows about.
 *
 * `reversal` is written by the BACKEND ONLY — it is what a "mark mistaken"
 * produces. Posting one is refused, which is why the postable subset below
 * excludes it at the type level rather than only in a dropdown.
 */
export type StockMovementType =
  | "purchase"
  | "draw"
  | "return"
  | "transfer_out"
  | "transfer_in"
  | "adjustment"
  | "initial_count"
  | "reversal";

/** The types a client may actually post. */
export type PostableStockMovementType = Exclude<StockMovementType, "reversal">;

/** +1 adds to a location, −1 takes away. `quantity` is always positive. */
export type StockDirection = 1 | -1;

/** Who paid for the stock. Mirrors the part-usage payer enum. */
export type StockPaidBy = "us" | "technician";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Locations                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export interface StorageLocation {
  id: number;
  name: string;
  /** Optional short code, unique among LIVE locations only. */
  code: string | null;
  address: string | null;
  /**
   * Soft-deleted rather than removed, so a retired location keeps its history
   * and its balances stay readable. Non-null means retired.
   */
  deletedAt: string | null;
  notes: TicketNote[] | null;
  attachments: TicketAttachment[] | null;
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Movements                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/** Minimal part reference carried on a movement line. */
export interface StockPartRef {
  id: number;
  name: string;
}

/** Minimal location reference carried on a movement line. */
export interface StockLocationRef {
  id: number;
  name: string;
  code: string | null;
}

export interface StockMovementLine {
  id: number;
  stockMovementId: number;
  partId: number;
  part: StockPartRef | null;
  storageLocationId: number;
  storageLocation: StockLocationRef | null;
  /** ALWAYS a positive magnitude. `direction` carries the sign. */
  quantity: number;
  unitCost: number | null;
  direction: StockDirection;
  /** quantity × direction — the signed contribution to on hand. */
  signedQuantity: number;
}

export interface StockMovement {
  id: number;
  type: EnumField;
  /**
   * WIRE SHAPE UNCONFIRMED. The client sends a naked local `YYYY-MM-DDTHH:mm`
   * (see CreateStockMovementPayload), but what the API echoes back has never
   * been checked — it may be date-only, RFC3339, or MySQL `Y-m-d H:i:s`.
   *
   * Render it through `formatWireDateTime`, which handles all three. NARROW
   * THIS TYPE and switch to `formatTimestamp` the day the contract is confirmed.
   */
  movedAt: string;
  paidBy: EnumField | null;
  paidByTechnicianId: number | null;
  paidByTechnician: { id: number; name: string } | null;
  /**
   * A display marker ONLY. It does NOT remove this movement from any balance —
   * the correction is the separate reversal movement, not this flag.
   */
  mistaken: boolean;
  /** When the API links the pair explicitly. Null means it did not. */
  reversalOfId: number | null;
  reversedByIds: number[];
  /** Null when the relation was not loaded (the list endpoint may omit it). */
  lines: StockMovementLine[] | null;
  notes: TicketNote[] | null;
  attachments: TicketAttachment[] | null;
  createdBy: number | null;
  creator: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Balances                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface StockBalance {
  partId: number;
  part: StockPartRef | null;
  storageLocationId: number;
  storageLocation: StockLocationRef | null;
  /**
   * CAN BE NEGATIVE — only ever as the trace of a reversal applied after the
   * stock had already been consumed. Render it; never clamp to zero. It is a
   * real signal that something needs reconciling.
   */
  onHand: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  List envelopes                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

export interface StockMovementListResponse {
  data: StockMovement[];
  links: LaravelPaginationLinks;
  meta: LaravelPaginationMeta;
}

export interface StockBalanceListResponse {
  data: StockBalance[];
  links: LaravelPaginationLinks;
  meta: LaravelPaginationMeta;
}

export interface StorageLocationListResponse {
  data: StorageLocation[];
  links: LaravelPaginationLinks;
  meta: LaravelPaginationMeta;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Filters                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export type StockMovementSortColumn = "moved_at" | "created_at" | "id";
export type StockSortDir = "asc" | "desc";

export interface StockMovementFilters {
  types?: StockMovementType[];
  part_ids?: number[];
  storage_location_ids?: number[];
  paid_by?: StockPaidBy[];
  paid_by_technician_ids?: number[];
  moved_from?: string;
  moved_to?: string;
  sort?: StockMovementSortColumn;
  dir?: StockSortDir;
  page?: number;
  per_page?: number;
}

export interface StockBalanceFilters {
  part_ids?: number[];
  storage_location_ids?: number[];
  /** Hides pairs that netted back to ZERO. Does NOT hide negatives. */
  non_zero?: boolean;
  page?: number;
  per_page?: number;
}

export interface StorageLocationFilters {
  trashed?: "with" | "only";
  page?: number;
  per_page?: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Payloads                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface CreateStorageLocationPayload {
  name: string;
  code?: string;
  address?: string;
}

export interface CreateStockMovementLinePayload {
  part_id: number;
  storage_location_id: number;
  /** Positive magnitude only. */
  quantity: number;
  unit_cost?: number;
  /**
   * Sent on EVERY line for EVERY type, even when the type fixes it.
   *
   * Harmless when it agrees with the type's fixed direction, and it is the
   * only shape that works if a transfer really is one movement carrying both
   * a −1 source line and a +1 destination line. See lib/storage/movement-types.
   */
  direction: StockDirection;
}

export interface CreateStockMovementPayload {
  /**
   * Local `YYYY-MM-DDTHH:mm` with NO offset — the server infers the zone.
   *
   * This deliberately does NOT match attendance, despite both using the same
   * DateTimePicker: attendance converts to UTC RFC3339 via
   * `toRfc3339OrUndefined` before sending. Same control, two wire contracts.
   * Recorded as a known divergence rather than silently aligned, because
   * changing it changes what gets persisted and needs a backend answer first.
   */
  moved_at: string;
  type: PostableStockMovementType;
  paid_by?: StockPaidBy;
  paid_by_technician_id?: number;
  /** Contiguous from 0 — a hole is silently dropped upstream. */
  lines: CreateStockMovementLinePayload[];
  notes?: { body: string; type?: string; files?: File[] }[];
}

/** `mistaken` returns the flagged original AND the reversal it just wrote. */
export interface MarkMistakenResponse {
  data: StockMovement;
  reversal: StockMovement | null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error state (used by the Zustand store)                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface StorageErrorState {
  message: string;
  code: string;
  retryable: boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Raw API snake_case mirrors — every decimal a string                      */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ApiStockPartRef {
  id: number;
  name: string;
}

export interface ApiStockLocationRef {
  id: number;
  name: string;
  code?: string | null;
}

export interface ApiStorageLocation {
  id: number;
  name: string;
  code?: string | null;
  address?: string | null;
  deleted_at?: string | null;
  notes?: ApiTicketNote[] | null;
  attachments?: ApiTicketAttachment[] | null;
  created_by?: number | null;
  creator?: { id: number; name: string; email?: string | null } | null;
  created_at: string;
  updated_at: string;
}

export interface ApiStockMovementLine {
  id: number;
  stock_movement_id: number;
  part_id: number;
  part?: ApiStockPartRef | null;
  storage_location_id: number;
  storage_location?: ApiStockLocationRef | null;
  quantity: string;
  unit_cost?: string | null;
  direction: number | string;
}

export interface ApiStockMovement {
  id: number;
  type: { value: string; label: string };
  moved_at: string;
  paid_by?: { value: string; label: string } | null;
  paid_by_technician_id?: number | null;
  paid_by_technician?: { id: number; name: string } | null;
  mistaken: boolean;
  /** Optional: the API may not link the pair explicitly. */
  reversal_of_id?: number | null;
  reversed_by_ids?: number[] | null;
  lines?: ApiStockMovementLine[] | null;
  notes?: ApiTicketNote[] | null;
  attachments?: ApiTicketAttachment[] | null;
  created_by?: number | null;
  creator?: { id: number; name: string; email?: string | null } | null;
  created_at: string;
  updated_at: string;
}

export interface ApiStockBalance {
  part_id: number;
  part?: ApiStockPartRef | null;
  storage_location_id: number;
  storage_location?: ApiStockLocationRef | null;
  on_hand: string;
}

/**
 * The envelope shape for these endpoints is undocumented, so the service
 * normalises BOTH the nested resource envelope and Laravel's flat
 * simple-pagination root — same defensive treatment as daily pay.
 */
export interface ApiPaginatedResponse<T> {
  data: T[];
  links?: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  } | null;
  meta?: {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
  } | null;
  current_page?: number;
  first_page_url?: string | null;
  from?: number | null;
  last_page?: number;
  last_page_url?: string | null;
  next_page_url?: string | null;
  per_page?: number;
  prev_page_url?: string | null;
  to?: number | null;
  total?: number;
}

export interface ApiStockMovementResponse {
  data: ApiStockMovement;
  reversal?: ApiStockMovement | null;
}

export interface ApiStorageLocationResponse {
  data: ApiStorageLocation;
}
