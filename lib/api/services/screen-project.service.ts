import axios from "axios";
import type { Station, SupervisorTokensResponse, ObserverTokensResponse } from "@/types/screen-project.types";

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

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const screenProjectService = {
  /**
   * Fetch all stations for a store.
   * Proxied through GET /api/screen-project/{storeId}/stations
   */
  async getStations(storeId: string, signal?: AbortSignal): Promise<Station[]> {
    const { data } = await axios.get<Station[]>(
      `/api/screen-project/${storeId}/stations`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Fetch supervisor tokens for all rooms in a store.
   * Proxied through POST /api/screen-project/{storeId}/tokens
   */
  async getSupervisorTokens(
    storeId: string,
    signal?: AbortSignal,
  ): Promise<SupervisorTokensResponse> {
    const { data } = await axios.post<SupervisorTokensResponse>(
      `/api/screen-project/${storeId}/tokens`,
      undefined,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Fetch observer tokens for all rooms in a store.
   * Proxied through POST /api/screen-project/{storeId}/tokens/observer
   */
  async getObserverTokens(
    storeId: string,
    signal?: AbortSignal,
  ): Promise<ObserverTokensResponse> {
    const { data } = await axios.post<ObserverTokensResponse>(
      `/api/screen-project/${storeId}/tokens/observer`,
      undefined,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Create a new station for a store.
   * Proxied through POST /api/screen-project/{storeId}/stations
   */
  async createStation(
    storeId: string,
    body: { name: string; room_name: string },
  ): Promise<Station> {
    const { data } = await axios.post<Station>(
      `/api/screen-project/${storeId}/stations`,
      body,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data;
  },

  /**
   * Delete a station by ID.
   * Proxied through DELETE /api/screen-project/{storeId}/stations/{stationId}
   */
  async deleteStation(storeId: string, stationId: number): Promise<void> {
    await axios.delete(
      `/api/screen-project/${storeId}/stations/${stationId}`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Set the shared station password for a store.
   * Proxied through POST /api/screen-project/{storeId}/stations/password
   */
  async setStationPassword(storeId: string, password: string): Promise<void> {
    await axios.post(
      `/api/screen-project/${storeId}/stations/password`,
      { password },
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },
};
