import axios from "axios";
import type {
  CreateSeparationRequestPayload,
  SeparationRequestsResponse,
  SeparationRequestDetail,
  SeparationRequestDetailResponse,
  SeparationSupervisorDecisionPayload,
  SeparationReviewPayload,
} from "@/types/separation.types";

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

export const separationService = {
  /**
   * Fetch separation requests for the given store.
   * Proxied through GET /api/hiring-management/[storeId]/separation-requests
   */
  async getSeparationRequests(
    storeId: string,
    page = 1,
    signal?: AbortSignal,
  ): Promise<SeparationRequestsResponse> {
    const { data } = await axios.get<SeparationRequestsResponse>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/separation-requests?page=${page}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /**
   * Fetch a single separation request by ID.
   * Proxied through GET /api/hiring-management/[storeId]/separation-requests/[separationId]
   */
  async getSeparationRequest(
    storeId: string,
    separationId: number,
  ): Promise<SeparationRequestDetail> {
    const { data } = await axios.get<SeparationRequestDetailResponse>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/separation-requests/${separationId}`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data.data;
  },

  /**
   * Delete a separation request.
   * Proxied through DELETE /api/hiring-management/[storeId]/separation-requests/[separationId]
   */
  async deleteSeparationRequest(
    storeId: string,
    separationId: number,
  ): Promise<void> {
    await axios.delete(
      `/api/hiring-management/${encodeURIComponent(storeId)}/separation-requests/${separationId}`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Submit supervisor decision for a separation request.
   * Proxied through POST /api/hiring-management/[storeId]/separation-requests/[separationId]/supervisor-decision
   */
  async submitSupervisorDecision(
    storeId: string,
    separationId: number,
    payload: SeparationSupervisorDecisionPayload,
  ): Promise<void> {
    await axios.post(
      `/api/hiring-management/${encodeURIComponent(storeId)}/separation-requests/${separationId}/supervisor-decision`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Submit a hiring review for a separation request.
   * Proxied through POST /api/hiring-management/[storeId]/separation-requests/[separationId]/hiring-review
   */
  async submitSeparationReview(
    storeId: string,
    separationId: number,
    payload: SeparationReviewPayload,
  ): Promise<void> {
    await axios.post(
      `/api/hiring-management/${encodeURIComponent(storeId)}/separation-requests/${separationId}/hiring-review`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Create a separation request for a specific employee (multipart/form-data).
   * Proxied through POST /api/hiring-management/[storeId]/separation-requests/employee/[employeeId]
   */
  async createSeparationRequest(
    storeId: string,
    employeeId: number,
    payload: CreateSeparationRequestPayload,
  ): Promise<void> {
    const formData = new FormData();
    formData.append("final_work_date", payload.final_work_date);
    formData.append("reason_type", payload.reason_type);
    formData.append("separation_type", payload.separation_type);

    if (payload.reason_id != null) {
      formData.append("reason_id", String(payload.reason_id));
    }
    if (payload.reason_title) {
      formData.append("reason_title", payload.reason_title);
    }
    if (payload.other_notes) {
      formData.append("other_notes", payload.other_notes);
    }
    if (payload.termination_letter) {
      formData.append("termination_letter", payload.termination_letter);
    }
    if (payload.attachments && payload.attachments.length > 0) {
      payload.attachments.forEach((att, i) => {
        formData.append(`attachments[${i}][file]`, att.file);
        if (att.note) {
          formData.append(`attachments[${i}][note]`, att.note);
        }
      });
    }

    const token = getToken();
    if (!token) throw new Error("Not logged in.");

    await axios.post(
      `/api/hiring-management/${encodeURIComponent(storeId)}/separation-requests/employee/${employeeId}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 30_000,
      },
    );
  },
};
