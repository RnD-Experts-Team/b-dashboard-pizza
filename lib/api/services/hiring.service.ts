import axios from "axios";
import type {
  CreateHiringRequestPayload,
  HiringRequest,
  HiringRequestRecord,
  HiringRequestsResponse,
  HiringRequestSingleResponse,
  HiringReviewPayload,
  SupervisorDecisionPayload,
  ShiftRecord,
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
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

export const hiringService = {
  /**
   * Fetch hiring requests for the given store.
   * Proxied through GET /api/hiring-management/[storeId]/hiring-requests
   */
  async getHiringRequests(
    storeId: string,
    page = 1,
    signal?: AbortSignal,
  ): Promise<HiringRequestsResponse> {
    const { data } = await axios.get<HiringRequestsResponse>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/hiring-requests?page=${page}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Fetch a single hiring request by ID.
   * Proxied through GET /api/hiring-management/[storeId]/hiring-requests/[requestId]
   */
  async getHiringRequest(
    storeId: string,
    requestId: number,
  ): Promise<HiringRequestRecord> {
    const { data } = await axios.get<HiringRequestSingleResponse>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/hiring-requests/${requestId}`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data.data;
  },

  /**
   * Create a hiring request for the given store.
   * Proxied through POST /api/hiring-management/[storeId]/hiring-requests
   */
  async createHiringRequest(
    storeId: string,
    payload: CreateHiringRequestPayload,
  ): Promise<HiringRequest> {
    const { data } = await axios.post<HiringRequest>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/hiring-requests`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data;
  },

  /**
   * Update a hiring request.
   * Proxied through PUT /api/hiring-management/[storeId]/hiring-requests/[requestId]
   */
  async updateHiringRequest(
    storeId: string,
    requestId: number,
    payload: CreateHiringRequestPayload,
  ): Promise<HiringRequest> {
    const { data } = await axios.put<HiringRequest>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/hiring-requests/${requestId}`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data;
  },

  /**
   * Delete a hiring request.
   * Proxied through DELETE /api/hiring-management/[storeId]/hiring-requests/[requestId]
   */
  async deleteHiringRequest(
    storeId: string,
    requestId: number,
  ): Promise<void> {
    await axios.delete(
      `/api/hiring-management/${encodeURIComponent(storeId)}/hiring-requests/${requestId}`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Submit a hiring review.
   * Proxied through POST /api/hiring-management/[storeId]/hiring-requests/[requestId]/hiring-review
   */
  async submitHiringReview(
    storeId: string,
    requestId: number,
    payload: HiringReviewPayload,
  ): Promise<void> {
    await axios.post(
      `/api/hiring-management/${encodeURIComponent(storeId)}/hiring-requests/${requestId}/hiring-review`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Submit a supervisor decision.
   * Proxied through POST /api/hiring-management/[storeId]/hiring-requests/[requestId]/supervisor-decision
   */
  async submitSupervisorDecision(
    storeId: string,
    requestId: number,
    payload: SupervisorDecisionPayload,
  ): Promise<void> {
    await axios.post(
      `/api/hiring-management/${encodeURIComponent(storeId)}/hiring-requests/${requestId}/supervisor-decision`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Get data for the create-employee page (shifts, etc.).
   * Proxied through GET /api/hiring-management/[storeId]/create-employee-page
   */
  async getCreateEmployeePage(storeId: string): Promise<ShiftRecord[]> {
    const { data } = await axios.get(
      `/api/hiring-management/${encodeURIComponent(storeId)}/create-employee-page`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return (data?.data?.shifts ?? data?.shifts ?? []) as ShiftRecord[];
  },
};
