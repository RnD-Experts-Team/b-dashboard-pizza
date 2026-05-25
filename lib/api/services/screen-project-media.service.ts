import axios from "axios";
import type {
  StationMedia,
  FinalizeUploadItem,
  BulkCompleteResponse,
} from "@/types/screen-project-media.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Auth helper — reads the Zustand-persisted token from localStorage       */
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

function buildHeaders() {
  const token = getToken();
  if (!token) throw new Error("Not logged in.");
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

const BASE = (storeId: string, station: number) =>
  `/api/screen-project/${storeId}/stations/${station}/media`;

const PUBLIC_BASE = (storeId: string, station: number) =>
  `/api/public/screen-project/${storeId}/stations/${station}/media`;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const screenProjectMediaService = {
  /**
   * List all media for a station.
   * GET /api/screen-project/{storeId}/stations/{station}/media
   */
  async listMedia(storeId: string, station: number): Promise<StationMedia[]> {
    const { data } = await axios.get<unknown>(BASE(storeId, station), {
      headers: buildHeaders(),
      timeout: 15_000,
    });
    // Normalize: API may return a plain array or a wrapped object
    if (Array.isArray(data)) return data as StationMedia[];
    const d = data as Record<string, unknown>;
    const inner = d?.data ?? d?.results ?? d?.media ?? d?.items ?? [];
    return Array.isArray(inner) ? (inner as StationMedia[]) : [];
  },

  /**
   * List media for a station — public, no supervisor auth required.
   * Used by the station screen to load the primary media fallback.
   * GET /api/public/screen-project/{storeId}/stations/{station}/media
   */
  async listMediaPublic(storeId: string, station: number): Promise<StationMedia[]> {
    const { data } = await axios.get<unknown>(PUBLIC_BASE(storeId, station), {
      headers: { Accept: "application/json" },
      timeout: 15_000,
    });
    if (Array.isArray(data)) return data as StationMedia[];
    const d = data as Record<string, unknown>;
    const inner = d?.data ?? d?.results ?? d?.media ?? d?.items ?? [];
    return Array.isArray(inner) ? (inner as StationMedia[]) : [];
  },

  /**
   * Start a chunked upload session.
   * POST /api/screen-project/{storeId}/stations/{station}/media/uploads
   * Returns { upload_id }
   */
  async initUpload(
    storeId: string,
    station: number,
    total_chunks: number,
  ): Promise<{ upload_id: string }> {
    const { data } = await axios.post<{ upload_id: string }>(
      `${BASE(storeId, station)}/uploads`,
      { total_chunks },
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data;
  },

  /**
   * Upload a single binary chunk.
   * POST /api/screen-project/{storeId}/stations/{station}/media/uploads/{uploadId}/chunks/{chunkIndex}
   * Body: multipart/form-data, field "chunk"
   */
  async uploadChunk(
    storeId: string,
    station: number,
    uploadId: string,
    chunkIndex: number,
    chunk: Blob,
  ): Promise<void> {
    const form = new FormData();
    form.append("chunk", chunk);
    await axios.post(
      `${BASE(storeId, station)}/uploads/${uploadId}/chunks/${chunkIndex}`,
      form,
      {
        headers: {
          ...buildHeaders(),
          // Content-Type is set automatically by the browser for FormData
        },
        timeout: 60_000,
      },
    );
  },

  /**
   * Finalize multiple uploads in one request.
   * POST /api/screen-project/{storeId}/stations/{station}/media/uploads/complete-bulk
   */
  async finalizeUploadsBulk(
    storeId: string,
    station: number,
    uploads: FinalizeUploadItem[],
  ): Promise<BulkCompleteResponse> {
    const { data } = await axios.post<BulkCompleteResponse>(
      `${BASE(storeId, station)}/uploads/complete-bulk`,
      { uploads },
      { headers: buildHeaders(), timeout: 30_000 },
    );
    return data;
  },

  /**
   * Set a media item as the primary media for the station.
   * POST /api/screen-project/{storeId}/stations/{station}/media/{mediaId}/primary
   */
  async setPrimaryMedia(
    storeId: string,
    station: number,
    mediaId: number,
  ): Promise<void> {
    await axios.post(
      `${BASE(storeId, station)}/${mediaId}/primary`,
      undefined,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Delete multiple media items.
   * DELETE /api/screen-project/{storeId}/stations/{station}/media/bulk
   */
  async bulkDeleteMedia(
    storeId: string,
    station: number,
    ids: number[],
  ): Promise<void> {
    await axios.delete(`${BASE(storeId, station)}/bulk`, {
      headers: buildHeaders(),
      data: { ids },
      timeout: 15_000,
    });
  },
};
