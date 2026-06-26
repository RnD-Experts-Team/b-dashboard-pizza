import axios from "axios";
import type {
  CreateMilestoneGiftPayload,
  SubmitMilestoneGiftRatingPayload,
  MilestoneGiftDecisionPayload,
  MilestoneGiftFinalStatusPayload,
  MilestoneGiftQuestionsResponse,
  MilestoneGiftQuestion,
  CreateMilestoneGiftQuestionPayload,
  UpdateMilestoneGiftQuestionPayload,
  MilestoneGiftOptionPayload,
} from "@/types/milestone-gift.types";

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

export const milestoneGiftService = {
  /**
   * Fetch the active milestone-gift questions visible to a store (rating form).
   * Proxied through GET /api/v1/stores/[storeId]/milestone-gift-questions
   */
  async getStoreQuestions(
    storeId: string,
    signal?: AbortSignal,
  ): Promise<MilestoneGiftQuestion[]> {
    const { data } = await axios.get<MilestoneGiftQuestionsResponse>(
      `/api/v1/stores/${encodeURIComponent(storeId)}/milestone-gift-questions`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data.data;
  },

  /* ── Question management (admin) ───────────────────────────────────────── */

  /**
   * Fetch ALL questions (incl. inactive + global + store-specific) for admin.
   * Proxied through GET /api/v1/milestone-gift-questions
   */
  async getAllQuestions(signal?: AbortSignal): Promise<MilestoneGiftQuestion[]> {
    const { data } = await axios.get<MilestoneGiftQuestionsResponse>(
      `/api/v1/milestone-gift-questions`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data.data;
  },

  /** Create a question. POST /api/v1/milestone-gift-questions */
  async createQuestion(
    payload: CreateMilestoneGiftQuestionPayload,
  ): Promise<void> {
    await axios.post(`/api/v1/milestone-gift-questions`, payload, {
      headers: buildHeaders(),
      timeout: 15_000,
    });
  },

  /** Update a question. PUT /api/v1/milestone-gift-questions/[questionId] */
  async updateQuestion(
    questionId: number,
    payload: UpdateMilestoneGiftQuestionPayload,
  ): Promise<void> {
    await axios.put(
      `/api/v1/milestone-gift-questions/${questionId}`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /** Deactivate a question. DELETE /api/v1/milestone-gift-questions/[questionId] */
  async deleteQuestion(questionId: number): Promise<void> {
    await axios.delete(`/api/v1/milestone-gift-questions/${questionId}`, {
      headers: buildHeaders(),
      timeout: 15_000,
    });
  },

  /** Add an option. POST /api/v1/milestone-gift-questions/[questionId]/options */
  async addOption(
    questionId: number,
    payload: MilestoneGiftOptionPayload,
  ): Promise<void> {
    await axios.post(
      `/api/v1/milestone-gift-questions/${questionId}/options`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /** Update an option. PUT /api/v1/milestone-gift-questions/[questionId]/options/[optionId] */
  async updateOption(
    questionId: number,
    optionId: number,
    payload: MilestoneGiftOptionPayload,
  ): Promise<void> {
    await axios.put(
      `/api/v1/milestone-gift-questions/${questionId}/options/${optionId}`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /** Delete an option. DELETE /api/v1/milestone-gift-questions/[questionId]/options/[optionId] */
  async deleteOption(questionId: number, optionId: number): Promise<void> {
    await axios.delete(
      `/api/v1/milestone-gift-questions/${questionId}/options/${optionId}`,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Stage 1 — create a milestone-gift ticket.
   * Proxied through POST /api/v1/stores/[storeId]/milestone-gift-requests
   */
  async createMilestoneGiftRequest(
    storeId: string,
    payload: CreateMilestoneGiftPayload,
  ): Promise<void> {
    await axios.post(
      `/api/v1/stores/${encodeURIComponent(storeId)}/milestone-gift-requests`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Stage 2 — submit the rating answers.
   * Proxied through POST /api/v1/stores/[storeId]/milestone-gift-requests/[requestId]/rating
   */
  async submitRating(
    storeId: string,
    requestId: number,
    payload: SubmitMilestoneGiftRatingPayload,
  ): Promise<void> {
    await axios.post(
      `/api/v1/stores/${encodeURIComponent(storeId)}/milestone-gift-requests/${requestId}/rating`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Stage 3 — record the gift decision (approve or cancel). Upsert.
   * Proxied through POST /api/v1/stores/[storeId]/milestone-gift-requests/[requestId]/gift-decision
   */
  async submitGiftDecision(
    storeId: string,
    requestId: number,
    payload: MilestoneGiftDecisionPayload,
  ): Promise<void> {
    await axios.post(
      `/api/v1/stores/${encodeURIComponent(storeId)}/milestone-gift-requests/${requestId}/gift-decision`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },

  /**
   * Stage 4 — set the final delivery status (and optionally close). Upsert.
   * Proxied through POST /api/v1/stores/[storeId]/milestone-gift-requests/[requestId]/final-status
   */
  async submitFinalStatus(
    storeId: string,
    requestId: number,
    payload: MilestoneGiftFinalStatusPayload,
  ): Promise<void> {
    await axios.post(
      `/api/v1/stores/${encodeURIComponent(storeId)}/milestone-gift-requests/${requestId}/final-status`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
  },
};
