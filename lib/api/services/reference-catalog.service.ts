import axios from "axios";
import type {
  ReferenceCatalogPayload,
  ReferenceCatalogResponse,
  GetReferenceCatalogResponse,
} from "@/types/hiring.types";

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
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export const referenceCatalogService = {
  /**
   * Fetch the full reference catalog.
   * GET /api/v1/reference-catalog
   */
  async getAll(signal?: AbortSignal): Promise<GetReferenceCatalogResponse> {
    const { data } = await axios.get<GetReferenceCatalogResponse>(
      "/api/v1/reference-catalog",
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Sync global reference catalog.
   * PUT /api/v1/reference-catalog
   */
  async sync(
    payload: ReferenceCatalogPayload,
    signal?: AbortSignal,
  ): Promise<ReferenceCatalogResponse> {
    const { data } = await axios.put<ReferenceCatalogResponse>(
      "/api/v1/reference-catalog",
      payload,
      { headers: buildHeaders(), timeout: 20_000, signal },
    );
    return data;
  },
};
