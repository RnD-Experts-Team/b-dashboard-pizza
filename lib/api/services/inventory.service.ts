import axios from "axios";
import { inventoryClient } from "@/lib/api/inventory-client";
import type { PaginatedResponse } from "@/types/api.types";
import type {
  Unit,
  UnitPayload,
  Item,
  ItemFormValues,
  Link,
  CreateLinkPayload,
  Entry,
  EntryDetail,
  EntryItem,
  UpdateEntryItemPayload,
  ListParams,
  EntryListParams,
  LinkListParams,
  PublicLink,
  PublicSubmitItem,
  PublicSubmitResponse,
} from "@/types/inventory.types";

/**
 * A no-auth axios instance for the PUBLIC inventory endpoints. Deliberately
 * separate from `inventoryClient` so it never attaches a Bearer token — the
 * employee opening a link is not authenticated. Same-origin `/api/public/inventory`
 * route.ts proxy (see app/api/public/inventory), so no CORS.
 */
const publicInventoryClient = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: { Accept: "application/json" },
});

/**
 * Inventory API services.
 *
 * The inventory backend paginates with a TOP-LEVEL `meta` block (Laravel API
 * resource collections), unlike the rest of this app. We transform that into the
 * shared PaginatedResponse shape so the existing <DataTable> pagination works.
 */

/** Raw paginated shape returned by the inventory backend. */
interface InventoryPaginated<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
}

/** Single-resource and create/update responses are wrapped as { data: {...} }. */
interface Wrapped<T> {
  data: T;
}

/** Transform the inventory pagination block into the app-wide PaginatedResponse. */
function toPaginated<T>(res: InventoryPaginated<T>): PaginatedResponse<T> {
  return {
    data: res.data,
    meta: {
      total: res.meta?.total ?? res.data.length,
      page: res.meta?.current_page ?? 1,
      pageSize: res.meta?.per_page ?? res.data.length,
      totalPages: res.meta?.last_page ?? 1,
    },
  };
}

/**
 * Rewrite an absolute backend image URL (http://127.0.0.1:8000/storage/...) to the
 * same-origin proxy path (/inventory-storage/...) so <img> loads without CORS/CSP issues.
 */
function rewriteImageUrl(url: string | null): string | null {
  if (!url) return url;
  const marker = "/storage/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return "/inventory-storage/" + url.slice(idx + marker.length);
}

/** Apply the image rewrite to an item before it reaches the UI. */
function normalizeItem(item: Item): Item {
  return { ...item, image: rewriteImageUrl(item.image) };
}

/** Build the multipart/form-data body for item create/update. */
function buildItemFormData(values: ItemFormValues, isUpdate: boolean): FormData {
  const fd = new FormData();
  fd.append("ultimatrix_id", values.ultimatrix_id);
  fd.append("name_en", values.name_en);
  fd.append("name_ar", values.name_ar);
  fd.append("name_es", values.name_es);
  // Optional detail fields — only send when filled.
  if (values.details_en) fd.append("details_en", values.details_en);
  if (values.details_ar) fd.append("details_ar", values.details_ar);
  if (values.details_es) fd.append("details_es", values.details_es);

  fd.append("unit_1_id", values.unit_1_id);
  fd.append("unit_2_id", values.unit_2_id);
  fd.append("unit_2_per_unit_1", values.unit_2_per_unit_1);
  // Third unit is optional; its ratio is required only when the unit is set.
  if (values.unit_3_id) {
    fd.append("unit_3_id", values.unit_3_id);
    fd.append("unit_3_per_unit_2", values.unit_3_per_unit_2);
  }

  // types[] — at least one of daily/weekly/period.
  values.types.forEach((t) => fd.append("types[]", t));

  // all_stores as 1/0; store_ids[] only when scoped to specific stores.
  fd.append("all_stores", values.all_stores ? "1" : "0");
  if (!values.all_stores) {
    values.store_ids.forEach((id) => fd.append("store_ids[]", id));
  }

  // Only attach the image when a new file was chosen.
  if (values.image) fd.append("image", values.image);

  // Laravel can't parse a real multipart PUT body — spoof the method on update.
  if (isUpdate) fd.append("_method", "PUT");

  return fd;
}

/* ── Units ─────────────────────────────────────────────────────────────── */
export const unitService = {
  list: async (
    params?: ListParams,
    signal?: AbortSignal
  ): Promise<PaginatedResponse<Unit>> => {
    const { data } = await inventoryClient.get<InventoryPaginated<Unit>>(
      "/inventory/units",
      { params: { page: params?.page, per_page: params?.perPage }, signal }
    );
    return toPaginated(data);
  },

  get: async (id: number, signal?: AbortSignal): Promise<Unit> => {
    const { data } = await inventoryClient.get<Wrapped<Unit>>(
      `/inventory/units/${id}`,
      { signal }
    );
    return data.data;
  },

  create: async (payload: UnitPayload): Promise<Unit> => {
    const { data } = await inventoryClient.post<Wrapped<Unit>>(
      "/inventory/units",
      payload
    );
    return data.data;
  },

  update: async (id: number, payload: UnitPayload): Promise<Unit> => {
    const { data } = await inventoryClient.put<Wrapped<Unit>>(
      `/inventory/units/${id}`,
      payload
    );
    return data.data;
  },

  remove: async (id: number): Promise<void> => {
    await inventoryClient.delete(`/inventory/units/${id}`);
  },
};

/* ── Items ─────────────────────────────────────────────────────────────── */
export const itemService = {
  // The list endpoint carries no store in its URL; pass the ambient store as an
  // X-Store-Id header so its now-scoped rule can authorize store-scoped permissions.
  list: async (
    params?: ListParams,
    storeId?: string,
    signal?: AbortSignal
  ): Promise<PaginatedResponse<Item>> => {
    const { data } = await inventoryClient.get<InventoryPaginated<Item>>(
      "/inventory/items",
      {
        params: { page: params?.page, per_page: params?.perPage },
        headers: storeId ? { "X-Store-Id": storeId } : undefined,
        signal,
      }
    );
    const paginated = toPaginated(data);
    return { ...paginated, data: paginated.data.map(normalizeItem) };
  },

  // Same store-header need as list() — the detail URL has no store either.
  get: async (
    id: number,
    storeId?: string,
    signal?: AbortSignal
  ): Promise<Item> => {
    const { data } = await inventoryClient.get<Wrapped<Item>>(
      `/inventory/items/${id}`,
      { headers: storeId ? { "X-Store-Id": storeId } : undefined, signal }
    );
    return normalizeItem(data.data);
  },

  create: async (values: ItemFormValues): Promise<Item> => {
    const { data } = await inventoryClient.post<Wrapped<Item>>(
      "/inventory/items",
      buildItemFormData(values, false)
    );
    return normalizeItem(data.data);
  },

  // Uses POST + _method=PUT (multipart) so the file upload reaches Laravel correctly.
  update: async (id: number, values: ItemFormValues): Promise<Item> => {
    const { data } = await inventoryClient.post<Wrapped<Item>>(
      `/inventory/items/${id}`,
      buildItemFormData(values, true)
    );
    return normalizeItem(data.data);
  },

  remove: async (id: number): Promise<void> => {
    await inventoryClient.delete(`/inventory/items/${id}`);
  },
};

/* ── Links ─────────────────────────────────────────────────────────────── */
export const linkService = {
  // Returns one link per employee (the API responds with an array under `data`).
  create: async (payload: CreateLinkPayload): Promise<Link[]> => {
    const { data } = await inventoryClient.post<Wrapped<Link[]>>(
      "/inventory/links",
      payload
    );
    return data.data;
  },

  listByStore: async (
    storeId: string,
    params?: LinkListParams,
    signal?: AbortSignal
  ): Promise<PaginatedResponse<Link>> => {
    const { data } = await inventoryClient.get<InventoryPaginated<Link>>(
      `/inventory/stores/${encodeURIComponent(storeId)}/links`,
      {
        params: {
          page: params?.page,
          per_page: params?.perPage,
          date_from: params?.date_from,
          date_to: params?.date_to,
          type: params?.type,
          status: params?.status,
          employee_id: params?.employee_id,
        },
        signal,
      }
    );
    return toPaginated(data);
  },

  get: async (id: number, signal?: AbortSignal): Promise<Link> => {
    const { data } = await inventoryClient.get<Wrapped<Link>>(
      `/inventory/links/${id}`,
      { signal }
    );
    return data.data;
  },
};

/* ── Entries ───────────────────────────────────────────────────────────── */
export const entryService = {
  listByStore: async (
    storeId: string,
    params?: EntryListParams,
    signal?: AbortSignal
  ): Promise<PaginatedResponse<Entry>> => {
    const { data } = await inventoryClient.get<InventoryPaginated<Entry>>(
      `/inventory/stores/${encodeURIComponent(storeId)}/entries`,
      {
        params: {
          page: params?.page,
          per_page: params?.perPage,
          date_from: params?.date_from,
          date_to: params?.date_to,
          type: params?.type,
          submitted_by: params?.submitted_by,
          edited: params?.edited !== undefined ? (params.edited ? 1 : 0) : undefined,
        },
        signal,
      }
    );
    return toPaginated(data);
  },

  // Basic detail — never includes is_edited/edits (see getHistory for that).
  // The entry URL carries no store, so we pass the current store as an
  // X-Store-Id header: the backend's store-scoped rule needs it to authorize a
  // store_manager (admins/specialists pass regardless).
  get: async (
    id: number,
    storeId?: string,
    signal?: AbortSignal
  ): Promise<EntryDetail> => {
    const { data } = await inventoryClient.get<Wrapped<EntryDetail>>(
      `/inventory/entries/${id}`,
      { signal, headers: storeId ? { "X-Store-Id": storeId } : undefined }
    );
    return data.data;
  },

  // Full detail with each item's is_edited + edits[]. 403s for callers without
  // the history permission — see useEntryDetail for the fallback strategy.
  getHistory: async (
    id: number,
    storeId?: string,
    signal?: AbortSignal
  ): Promise<EntryDetail> => {
    const { data } = await inventoryClient.get<Wrapped<EntryDetail>>(
      `/inventory/entries/${id}/history`,
      { signal, headers: storeId ? { "X-Store-Id": storeId } : undefined }
    );
    return data.data;
  },

  // Recount one entry item; the backend logs the change to an append-only history.
  // The entry-items URL carries no store, so we pass the current store as an
  // X-Store-Id header — the backend needs it to authorize a store_manager's edit.
  updateEntryItem: async (
    entryItemId: number,
    payload: UpdateEntryItemPayload,
    storeId?: string
  ): Promise<EntryItem> => {
    const { data } = await inventoryClient.patch<Wrapped<EntryItem>>(
      `/inventory/entry-items/${entryItemId}`,
      payload,
      { headers: storeId ? { "X-Store-Id": storeId } : undefined }
    );
    return data.data;
  },
};

/* ── Public (no auth) ──────────────────────────────────────────────────── */
export const publicInventoryService = {
  // Load the count form for a token. 404 = invalid, 410 = already submitted.
  getLink: async (token: string, signal?: AbortSignal): Promise<PublicLink> => {
    const { data } = await publicInventoryClient.get<Wrapped<PublicLink>>(
      `/public/inventory/${encodeURIComponent(token)}`,
      { signal }
    );
    // Rewrite absolute backend image URLs to the same-origin proxy path.
    return {
      ...data.data,
      items: data.data.items.map((it) => ({
        ...it,
        image: rewriteImageUrl(it.image),
      })),
    };
  },

  // Submit the counts. Single-use — 410 on any subsequent attempt.
  submit: async (
    token: string,
    items: PublicSubmitItem[]
  ): Promise<PublicSubmitResponse> => {
    const { data } = await publicInventoryClient.post<Wrapped<PublicSubmitResponse>>(
      `/public/inventory/${encodeURIComponent(token)}/submit`,
      { items }
    );
    return data.data;
  },
};
