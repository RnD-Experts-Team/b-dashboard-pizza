import axios from "axios";
import {
  MaintenanceTicketsError,
  transformAttachment,
  transformNote,
} from "@/lib/api/services/maintenance-tickets.service";
import { buildNestedFormData } from "@/lib/api/form-data";
import { parseDirection } from "@/lib/storage/movement-types";
import type {
  ApiPaginatedResponse,
  ApiStockBalance,
  ApiStockPlaceLine,
  ApiStoragePlaceLevel,
  ApiStoragePlaceValue,
  CreateStoragePlaceLevelPayload,
  CreateStoragePlaceValuePayload,
  SetStockPlacePayload,
  StockPlaceLine,
  StoragePlaceLevel,
  StoragePlaceValue,
  ApiPartStockTotal,
  PartStockTotal,
  PartStockTotalListResponse,
  ApiStockLocationRef,
  ApiStockMovement,
  ApiStockMovementLine,
  ApiStockMovementResponse,
  ApiStockPartRef,
  ApiStorageLocation,
  ApiStorageLocationResponse,
  CreateStockMovementPayload,
  CreateStorageLocationPayload,
  MarkMistakenResponse,
  StockBalance,
  StockBalanceFilters,
  StockBalanceListResponse,
  StockLocationRef,
  StockMovement,
  StockMovementFilters,
  StockMovementLine,
  StockMovementListResponse,
  StockPartRef,
  StorageLocation,
  StorageLocationFilters,
  StorageLocationListResponse,
} from "@/types/storage.types";
import type {
  EnumField,
  LaravelPaginationLinks,
  LaravelPaginationMeta,
  StorageLocationRef,
  UserRef,
} from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Storage locations, the stock ledger, and on-hand balances                */
/*                                                                            */
/*  These endpoints are GLOBAL, so they live in their own service: every      */
/*  method in maintenance-tickets.service.ts is (storeId, ticketId, …)-shaped */
/*  and that file is already 1700 lines.                                     */
/*                                                                            */
/*  It reuses MaintenanceTicketsError, so the `err.code === "CANCELLED"`      */
/*  idiom and the readStockShortfall / getTicketsFieldErrors helpers work     */
/*  identically across both services — one error taxonomy, two services.     */
/* ────────────────────────────────────────────────────────────────────────── */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth-token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function requireToken(): string {
  const token = getToken();
  if (!token) {
    throw new MaintenanceTicketsError(
      "You must be logged in to perform this action.",
      "NOT_AUTHENTICATED"
    );
  }
  return token;
}

function handleAxiosError(err: unknown): never {
  if (axios.isCancel(err) || (axios.isAxiosError(err) && err.code === "ERR_CANCELED")) {
    throw new MaintenanceTicketsError("Request cancelled.", "CANCELLED");
  }
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
    const message: string = data?.message || data?.error?.message || err.message;

    if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
      throw new MaintenanceTicketsError("Request timed out. Please try again.", "TIMEOUT");
    }
    if (status === 401) throw new MaintenanceTicketsError(message, "NOT_AUTHENTICATED");
    if (status === 403) throw new MaintenanceTicketsError(message, "FORBIDDEN");
    if (status === 404) throw new MaintenanceTicketsError(message, "NOT_FOUND");
    if (status === 422) {
      // `context` carries the stock-shortfall block — readStockShortfall reads it.
      throw new MaintenanceTicketsError(
        message || "Validation failed.",
        "VALIDATION_ERROR",
        data?.errors,
        data?.context
      );
    }
    if (status === 429) throw new MaintenanceTicketsError("Too many requests.", "RATE_LIMITED");
    if (status != null && status >= 500) {
      throw new MaintenanceTicketsError("Server error. Please try again.", "SERVER_ERROR");
    }
    if (!err.response) {
      throw new MaintenanceTicketsError("Network error. Check your connection.", "NETWORK_ERROR");
    }
  }
  throw new MaintenanceTicketsError("An unexpected error occurred.", "UNKNOWN");
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Transform helpers                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/** Never `parseFloat(x).toFixed()` — a partial payload would put NaN on screen. */
function safeDecimal(raw: string | number | null | undefined, fallback: number): number {
  if (raw == null) return fallback;
  const parsed = typeof raw === "number" ? raw : parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalDecimal(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const parsed = typeof raw === "number" ? raw : parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** null/undefined ⇒ null ("not loaded"); [] ⇒ [] ("loaded, nothing there"). */
function mapRelation<R, T>(raw: R[] | null | undefined, fn: (r: R) => T): T[] | null {
  return raw == null ? null : raw.map(fn);
}

function transformUserRef(
  raw: { id: number; name: string; email?: string | null } | null | undefined
): UserRef | null {
  return raw ? { id: raw.id, name: raw.name, email: raw.email ?? null } : null;
}

function transformEnumField(raw: { value: string; label: string }): EnumField {
  return { value: raw.value, label: raw.label };
}

function transformPartRef(raw: ApiStockPartRef | null | undefined): StockPartRef | null {
  return raw ? { id: raw.id, name: raw.name } : null;
}

function transformLocationRef(
  raw: ApiStockLocationRef | null | undefined
): StockLocationRef | null {
  return raw ? { id: raw.id, name: raw.name, code: raw.code ?? null } : null;
}

/**
 * Normalises BOTH the nested resource envelope ({ data, meta, links }) and
 * Laravel's flat simple-pagination root. The shape these endpoints actually
 * use is undocumented, so handle both rather than guess.
 */
function transformPagination<T>(raw: ApiPaginatedResponse<T>): {
  meta: LaravelPaginationMeta;
  links: LaravelPaginationLinks;
} {
  if (raw.meta) {
    return {
      meta: {
        currentPage: raw.meta.current_page,
        from: raw.meta.from,
        lastPage: raw.meta.last_page,
        perPage: raw.meta.per_page,
        to: raw.meta.to,
        total: raw.meta.total,
      },
      links: {
        first: raw.links?.first ?? null,
        last: raw.links?.last ?? null,
        prev: raw.links?.prev ?? null,
        next: raw.links?.next ?? null,
      },
    };
  }

  const rows = raw.data ?? [];
  const total = raw.total ?? rows.length;
  const perPage = raw.per_page ?? (rows.length || 25);
  return {
    meta: {
      currentPage: raw.current_page ?? 1,
      from: raw.from ?? (rows.length ? 1 : null),
      lastPage: raw.last_page ?? 1,
      perPage,
      to: raw.to ?? (rows.length || null),
      total,
    },
    links: {
      first: raw.first_page_url ?? null,
      last: raw.last_page_url ?? null,
      prev: raw.prev_page_url ?? null,
      next: raw.next_page_url ?? null,
    },
  };
}

function transformStorageLocation(raw: ApiStorageLocation): StorageLocation {
  return {
    id: raw.id,
    name: raw.name,
    code: raw.code ?? null,
    address: raw.address ?? null,
    deletedAt: raw.deleted_at ?? null,
    notes: mapRelation(raw.notes, transformNote),
    attachments: mapRelation(raw.attachments, transformAttachment),
    createdBy: raw.created_by ?? null,
    creator: transformUserRef(raw.creator),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformMovementLine(raw: ApiStockMovementLine): StockMovementLine {
  const quantity = safeDecimal(raw.quantity, 0);
  const direction = parseDirection(raw.direction);
  return {
    id: raw.id,
    stockMovementId: raw.stock_movement_id,
    partId: raw.part_id,
    part: transformPartRef(raw.part),
    storageLocationId: raw.storage_location_id,
    storageLocation: transformLocationRef(raw.storage_location),
    quantity,
    unitCost: optionalDecimal(raw.unit_cost),
    direction,
    // The signed contribution to on hand. Precomputed so no caller has to
    // remember that `quantity` is an unsigned magnitude.
    signedQuantity: quantity * direction,
  };
}

function transformMovement(raw: ApiStockMovement): StockMovement {
  return {
    id: raw.id,
    type: transformEnumField(raw.type),
    movedAt: raw.moved_at,
    paidBy: raw.paid_by ? transformEnumField(raw.paid_by) : null,
    paidByTechnicianId: raw.paid_by_technician_id ?? null,
    paidByTechnician: raw.paid_by_technician
      ? { id: raw.paid_by_technician.id, name: raw.paid_by_technician.name }
      : null,
    mistaken: raw.mistaken,
    reversalOfId: raw.reversal_of_id ?? null,
    reversedByIds: raw.reversed_by_ids ?? [],
    lines: mapRelation(raw.lines, transformMovementLine),
    notes: mapRelation(raw.notes, transformNote),
    attachments: mapRelation(raw.attachments, transformAttachment),
    createdBy: raw.created_by ?? null,
    creator: transformUserRef(raw.creator),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformBalance(raw: ApiStockBalance): StockBalance {
  return {
    id: raw.id,
    partId: raw.part_id,
    part: transformPartRef(raw.part),
    storageLocationId: raw.storage_location_id,
    storageLocation: transformLocationRef(raw.storage_location),
    place: transformPlace(raw.place),
    // NOT clamped. A negative is the trace of a reversal applied after the
    // stock was consumed, and it is a real signal that needs surfacing.
    onHand: safeDecimal(raw.quantity, 0),
  };
}

/**
 * The address, kept in the order the server sent it.
 *
 * DO NOT SORT THIS. The order is the address -- "C / 8 / 5" only means
 * shelf-row-column because the backend ordered it by the location's own level
 * order, and re-sorting here by anything else would quietly rewrite what the
 * address says.
 *
 * `[]` is a real answer meaning nobody has said, distinct from "nowhere".
 */
function transformPlace(raw: ApiStockPlaceLine[] | null | undefined): StockPlaceLine[] {
  return (raw ?? []).map((line) => ({
    levelId: line.level_id,
    level: line.level,
    valueId: line.value_id,
    value: line.value,
  }));
}

function transformPlaceLevel(raw: ApiStoragePlaceLevel): StoragePlaceLevel {
  return {
    id: raw.id,
    storageLocationId: raw.storage_location_id,
    name: raw.name,
    sortOrder: raw.sort_order ?? 0,
    // null, not []: "we did not ask for the values" and "this level has none
    // declared yet" are different, and only one of them is worth a prompt.
    values: raw.values ? raw.values.map(transformPlaceValue) : null,
    deletedAt: raw.deleted_at ?? null,
  };
}

function transformPlaceValue(raw: ApiStoragePlaceValue): StoragePlaceValue {
  return {
    id: raw.id,
    storagePlaceLevelId: raw.storage_place_level_id,
    value: raw.value,
    sortOrder: raw.sort_order ?? 0,
    deletedAt: raw.deleted_at ?? null,
  };
}

function transformPartTotal(raw: ApiPartStockTotal): PartStockTotal {
  return {
    partId: raw.part_id,
    part: transformPartRef(raw.part),
    // Same guard as the ungrouped transform: a missing field must not render
    // as a confident 0. `quantity` is the wire name -- NOT `on_hand`, which
    // does not exist upstream and cost this feature every number on screen.
    onHand: safeDecimal(raw.quantity, 0),
    // optionalDecimal, NOT safeDecimal: a missing value must stay null so the
    // UI renders an em dash. safeDecimal's 0 fallback is right for a quantity
    // (a shelf really can hold none) and wrong for a value we were not told.
    value: optionalDecimal(raw.value),
    averageUnitCost: optionalDecimal(raw.average_unit_cost),
    unknownCostQuantity: optionalDecimal(raw.unknown_cost_quantity),
    locationCount: raw.location_count ?? 0,
    // `[]` not null: this shape always sends the breakdown, so an empty array
    // genuinely means "on no shelf", not "not loaded".
    locations: (raw.locations ?? []).map((l) => ({
      stockBalanceId: l.id ?? null,
      storageLocationId: l.storage_location_id,
      storageLocation: transformLocationRef(l.storage_location),
      place: transformPlace(l.place),
      onHand: safeDecimal(l.quantity, 0),
    })),
    updatedAt: raw.updated_at ?? null,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Query builders — repeated keys, matching buildFilterParams' style        */
/* ────────────────────────────────────────────────────────────────────────── */

export function buildStockMovementParams(f: StockMovementFilters): URLSearchParams {
  const p = new URLSearchParams();
  (f.types ?? []).forEach((v) => v && p.append("types[]", v));
  (f.part_ids ?? []).forEach((v) => p.append("part_ids[]", String(v)));
  (f.storage_location_ids ?? []).forEach((v) =>
    p.append("storage_location_ids[]", String(v))
  );
  (f.paid_by ?? []).forEach((v) => v && p.append("paid_by[]", v));
  (f.paid_by_technician_ids ?? []).forEach((v) =>
    p.append("paid_by_technician_ids[]", String(v))
  );
  if (f.moved_from) p.set("moved_from", f.moved_from);
  if (f.moved_to) p.set("moved_to", f.moved_to);
  if (f.sort) p.set("sort", f.sort);
  if (f.dir) p.set("dir", f.dir);
  if (f.page) p.set("page", String(f.page));
  if (f.per_page) p.set("per_page", String(f.per_page));
  return p;
}

export function buildStockBalanceParams(f: StockBalanceFilters): URLSearchParams {
  const p = new URLSearchParams();
  (f.part_ids ?? []).forEach((v) => p.append("part_ids[]", String(v)));
  (f.storage_location_ids ?? []).forEach((v) =>
    p.append("storage_location_ids[]", String(v))
  );
  // Hides pairs that netted back to ZERO. It does NOT hide negatives — see
  // the Balances tab, where "negative only" is kept independent of this.
  if (f.non_zero) p.set("non_zero", "1");
  // Only the shortages. Server-side on purpose: counting or listing negatives
  // by filtering a loaded page is only ever true for that page.
  if (f.negative_only) p.set("negative_only", "1");
  // Rolls the (part, location) pairs up into one row per part. non_zero then
  // applies to the total rather than to each pair.
  if (f.group_by) p.set("group_by", f.group_by);
  if (f.page) p.set("page", String(f.page));
  if (f.per_page) p.set("per_page", String(f.per_page));
  return p;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

const BASE = "/api/maintenance-tickets";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

export const storageService = {
  /* ── Locations ────────────────────────────────────────────────────────── */

  /**
   * Live storage locations as a flat ref list, for dropdowns.
   *
   * SIGNATURE IS LOAD-BEARING: part-usage-panel.tsx calls this for its shelf
   * picker. Do not change its shape — add a new method instead.
   */
  async listStorageLocations(signal?: AbortSignal): Promise<StorageLocationRef[]> {
    const token = requireToken();
    try {
      const res = await axios.get<ApiPaginatedResponse<ApiStorageLocation>>(
        `${BASE}/storage-locations`,
        { params: { per_page: 200 }, headers: authHeaders(token), timeout: 15_000, signal }
      );
      return (res.data.data ?? []).map((raw) => ({
        id: raw.id,
        name: raw.name,
        code: raw.code ?? null,
      }));
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Full locations list, paginated, optionally including retired ones. */
  async getStorageLocations(
    filters?: StorageLocationFilters,
    signal?: AbortSignal
  ): Promise<StorageLocationListResponse> {
    const token = requireToken();
    const params = new URLSearchParams();
    if (filters?.trashed) params.set("trashed", filters.trashed);
    params.set("per_page", String(filters?.per_page ?? 50));
    if (filters?.page) params.set("page", String(filters.page));
    try {
      const res = await axios.get<ApiPaginatedResponse<ApiStorageLocation>>(
        `${BASE}/storage-locations?${params}`,
        { headers: authHeaders(token), timeout: 15_000, signal }
      );
      const { meta, links } = transformPagination(res.data);
      return { data: (res.data.data ?? []).map(transformStorageLocation), meta, links };
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  async createStorageLocation(
    payload: CreateStorageLocationPayload,
    files?: File[]
  ): Promise<StorageLocation> {
    const token = requireToken();
    try {
      const res = await axios.post<ApiStorageLocationResponse>(
        `${BASE}/storage-locations`,
        buildNestedFormData(payload, files),
        { headers: authHeaders(token), timeout: 120_000 }
      );
      return transformStorageLocation(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Soft delete — the location keeps its history and its balances. */
  async deleteStorageLocation(id: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.delete(`${BASE}/storage-locations/${id}`, {
        headers: authHeaders(token),
        timeout: 15_000,
      });
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  async restoreStorageLocation(id: number): Promise<void> {
    const token = requireToken();
    try {
      // The proxy route parses the body as JSON, so `{}` — not an empty body.
      await axios.post(
        `${BASE}/storage-locations/${id}/restore`,
        {},
        {
          headers: { ...authHeaders(token), "Content-Type": "application/json" },
          timeout: 15_000,
        }
      );
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /* ── Movements ────────────────────────────────────────────────────────── */

  async getStockMovements(
    filters?: StockMovementFilters,
    signal?: AbortSignal
  ): Promise<StockMovementListResponse> {
    const token = requireToken();
    const qs = buildStockMovementParams(filters ?? {}).toString();
    try {
      const res = await axios.get<ApiPaginatedResponse<ApiStockMovement>>(
        `${BASE}/stock-movements${qs ? `?${qs}` : ""}`,
        { headers: authHeaders(token), timeout: 15_000, signal }
      );
      const { meta, links } = transformPagination(res.data);
      return { data: (res.data.data ?? []).map(transformMovement), meta, links };
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  async getStockMovement(id: number, signal?: AbortSignal): Promise<StockMovement> {
    const token = requireToken();
    try {
      const res = await axios.get<ApiStockMovementResponse>(`${BASE}/stock-movements/${id}`, {
        headers: authHeaders(token),
        timeout: 15_000,
        signal,
      });
      return transformMovement(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * One movement is one batch. Callers MUST filter empty line rows out before
   * building the payload: appendDeep indexes by array position, so a hole is
   * silently dropped upstream — a 201 with missing lines, not an error.
   */
  async createStockMovement(
    payload: CreateStockMovementPayload,
    files?: File[]
  ): Promise<StockMovement> {
    const token = requireToken();
    if (payload.lines.length === 0) {
      throw new MaintenanceTicketsError(
        "A movement needs at least one line.",
        "VALIDATION_ERROR",
        { lines: ["A movement needs at least one line."] }
      );
    }
    try {
      const res = await axios.post<ApiStockMovementResponse>(
        `${BASE}/stock-movements`,
        buildNestedFormData(payload, files),
        { headers: authHeaders(token), timeout: 120_000 }
      );
      return transformMovement(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Flags the original AND writes the reversing movement. Returns BOTH, so the
   * UI can show the correction landing rather than implying a deletion.
   *
   * The flag itself changes no balance — the reversal is what does.
   */
  async markStockMovementMistaken(id: number): Promise<MarkMistakenResponse> {
    const token = requireToken();
    try {
      const res = await axios.post<ApiStockMovementResponse>(
        `${BASE}/stock-movements/${id}/mistaken`,
        {},
        {
          headers: { ...authHeaders(token), "Content-Type": "application/json" },
          timeout: 30_000,
        }
      );
      return {
        data: transformMovement(res.data.data),
        reversal: res.data.reversal ? transformMovement(res.data.reversal) : null,
      };
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /* ── Balances ─────────────────────────────────────────────────────────── */

  /**
   * On hand per part per location, computed upstream over the WHOLE ledger.
   *
   * Never derive this by summing a page of movements — the ledger is
   * unfiltered and paginated, so a page sum is meaningless.
   */
  async getStockBalances(
    filters?: StockBalanceFilters,
    signal?: AbortSignal
  ): Promise<StockBalanceListResponse> {
    const token = requireToken();
    const qs = buildStockBalanceParams(filters ?? {}).toString();
    try {
      const res = await axios.get<ApiPaginatedResponse<ApiStockBalance>>(
        `${BASE}/stock-balances${qs ? `?${qs}` : ""}`,
        { headers: authHeaders(token), timeout: 15_000, signal }
      );
      const { meta, links } = transformPagination(res.data);
      return { data: (res.data.data ?? []).map(transformBalance), meta, links };
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * On hand per PART, totalled across locations, with the breakdown.
   *
   * Same endpoint, ?group_by=part. Use this wherever the question is "do we
   * have any" -- which is nearly everywhere a human is asking. The ungrouped
   * call above answers "which shelf", which is a different question.
   */
  async getPartStockTotals(
    filters?: StockBalanceFilters,
    signal?: AbortSignal
  ): Promise<PartStockTotalListResponse> {
    const token = requireToken();
    const qs = buildStockBalanceParams({ ...(filters ?? {}), group_by: "part" }).toString();
    try {
      const res = await axios.get<ApiPaginatedResponse<ApiPartStockTotal>>(
        `${BASE}/stock-balances${qs ? `?${qs}` : ""}`,
        { headers: authHeaders(token), timeout: 15_000, signal }
      );
      const { meta, links } = transformPagination(res.data);
      return { data: (res.data.data ?? []).map(transformPartTotal), meta, links };
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /* ── Place levels & values ───────────────────────────────────────────── */

  /**
   * How one location addresses the space inside it, with each level's declared
   * values.
   *
   * Paths are `place-levels`, not `slots`. The parameter names upstream are
   * load-bearing: Laravel resolves a scoped binding's relation from the
   * parameter name, and the slots endpoints this replaces 500'd on every PATCH
   * and DELETE because `{storageSlot}` did not match `slots()`.
   */
  async getPlaceLevels(
    locationId: number,
    signal?: AbortSignal
  ): Promise<StoragePlaceLevel[]> {
    const token = requireToken();
    try {
      const res = await axios.get<{ data: ApiStoragePlaceLevel[] }>(
        `${BASE}/storage-locations/${locationId}/place-levels`,
        { headers: authHeaders(token), timeout: 15_000, signal }
      );
      return (res.data.data ?? []).map(transformPlaceLevel);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  async createPlaceLevel(
    locationId: number,
    payload: CreateStoragePlaceLevelPayload
  ): Promise<StoragePlaceLevel> {
    const token = requireToken();
    try {
      const res = await axios.post<{ data: ApiStoragePlaceLevel }>(
        `${BASE}/storage-locations/${locationId}/place-levels`,
        payload,
        { headers: authHeaders(token), timeout: 15_000 }
      );
      return transformPlaceLevel(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Levels are editable, unlike locations -- a mislabelled level is not worth
   *  retiring and recreating along with all of its values. */
  async updatePlaceLevel(
    locationId: number,
    levelId: number,
    payload: CreateStoragePlaceLevelPayload
  ): Promise<StoragePlaceLevel> {
    const token = requireToken();
    try {
      const res = await axios.patch<{ data: ApiStoragePlaceLevel }>(
        `${BASE}/storage-locations/${locationId}/place-levels/${levelId}`,
        payload,
        { headers: authHeaders(token), timeout: 15_000 }
      );
      return transformPlaceLevel(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Retires the level, its values, AND the addresses that used them. Nothing
   *  is left pointing at something that will never be shown again. */
  async deletePlaceLevel(locationId: number, levelId: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.delete(`${BASE}/storage-locations/${locationId}/place-levels/${levelId}`, {
        headers: authHeaders(token),
        timeout: 15_000,
      });
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  async createPlaceValue(
    locationId: number,
    levelId: number,
    payload: CreateStoragePlaceValuePayload
  ): Promise<StoragePlaceValue> {
    const token = requireToken();
    try {
      const res = await axios.post<{ data: ApiStoragePlaceValue }>(
        `${BASE}/storage-locations/${locationId}/place-levels/${levelId}/values`,
        payload,
        { headers: authHeaders(token), timeout: 15_000 }
      );
      return transformPlaceValue(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  async updatePlaceValue(
    locationId: number,
    levelId: number,
    valueId: number,
    payload: CreateStoragePlaceValuePayload
  ): Promise<StoragePlaceValue> {
    const token = requireToken();
    try {
      const res = await axios.patch<{ data: ApiStoragePlaceValue }>(
        `${BASE}/storage-locations/${locationId}/place-levels/${levelId}/values/${valueId}`,
        payload,
        { headers: authHeaders(token), timeout: 15_000 }
      );
      return transformPlaceValue(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  async deletePlaceValue(
    locationId: number,
    levelId: number,
    valueId: number
  ): Promise<void> {
    const token = requireToken();
    try {
      await axios.delete(
        `${BASE}/storage-locations/${locationId}/place-levels/${levelId}/values/${valueId}`,
        { headers: authHeaders(token), timeout: 15_000 }
      );
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Say where a part sits inside its location.
   *
   * THE COMPLETE ADDRESS, every time. A level left out of `valueIds` is
   * cleared, and `[]` clears the lot -- which is the honest way to say "we no
   * longer know", different from never having said.
   *
   * This is the write path the slot feature never had: it could name shelves
   * and display them, and nothing could ever put a part on one.
   */
  async setStockBalancePlace(
    balanceId: number,
    valueIds: number[]
  ): Promise<StockPlaceLine[]> {
    const token = requireToken();
    try {
      const res = await axios.put<{ data: ApiStockPlaceLine[] }>(
        `${BASE}/stock-balances/${balanceId}/place`,
        { place_value_ids: valueIds } satisfies SetStockPlacePayload,
        { headers: authHeaders(token), timeout: 15_000 }
      );
      return transformPlace(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** On hand for one part at one location, for the composer's inline hint. */
  async getOnHand(
    partId: number,
    storageLocationId: number,
    signal?: AbortSignal
  ): Promise<number | null> {
    const res = await this.getStockBalances(
      { part_ids: [partId], storage_location_ids: [storageLocationId], per_page: 1 },
      signal
    );
    return res.data[0]?.onHand ?? null;
  },
};
