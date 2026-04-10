import axios from "axios";
import type {
  CreateHiringRequestPayload,
  CreateEmployeePageData,
  HiringRequest,
  HiringRequestRecord,
  HiringRequestsResponse,
  HiringRequestSingleResponse,
  HiringReviewPayload,
  SupervisorDecisionPayload,
  ShiftRecord,
  EmployeeStatusRecord,
  PositionRecord,
  EmployeeFileTypeRecord,
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

function extractFilename(contentDisposition?: string): string | null {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const plainMatch = contentDisposition.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim() ?? null;
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
   * Get data for the create-employee page (shifts, employee statuses, positions, separation reasons, etc.).
   * Proxied through GET /api/hiring-management/[storeId]/create-employee-page
   */
  async getCreateEmployeePage(storeId: string): Promise<CreateEmployeePageData> {
    const { data } = await axios.get(
      `/api/hiring-management/${encodeURIComponent(storeId)}/create-employee-page`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    const d = data?.data ?? data ?? {};
    return {
      shifts: (d.shifts ?? []) as ShiftRecord[],
      employeeStatuses: (d.employeeStatuses ?? []) as EmployeeStatusRecord[],
      positions: (d.positions ?? []) as PositionRecord[],
      employeeFileTypes: (d.employeeFileTypes ?? []) as EmployeeFileTypeRecord[],
      separationReasons: (d.separationReasons ?? []),
    };
  },

  /**
   * Export hiring requests and trigger file download in the browser.
   * Proxied through GET /api/stores/[storeId]/exports/hiring-requests
   */
  async exportHiringRequests(storeId: string): Promise<void> {
    const response = await axios.get(
      `/api/stores/${encodeURIComponent(storeId)}/exports/hiring-requests`,
      {
        headers: buildHeaders(),
        responseType: "blob",
        timeout: 5 * 60_000,
      },
    );

    const filename =
      extractFilename(response.headers["content-disposition"]) ||
      "hiring-requests-export.xlsx";

    const blob = response.data as Blob;
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },
};
