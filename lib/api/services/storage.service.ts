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
    partId: raw.part_id,
    part: transformPartRef(raw.part),
    storageLocationId: raw.storage_location_id,
    storageLocation: transformLocationRef(raw.storage_location),
    // NOT clamped. A negative is the trace of a reversal applied after the
    // stock was consumed, and it is a real signal that needs surfacing.
    onHand: safeDecimal(raw.on_hand, 0),
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
