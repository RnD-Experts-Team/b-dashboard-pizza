/* ──────────────────────────────────────────────────────────────────────────
 * Milestone Gift Request — types
 * Mirrors the backend milestone-gift workflow (create → rating → gift-decision
 * → final-status → closed/cancelled). Requests are surfaced through the unified
 * store-requests feed with request_type === "milestone_gift".
 * ────────────────────────────────────────────────────────────────────────── */

export type Milestone =
  | "8_days"
  | "1_month"
  | "2_months"
  | "3_months"
  | "4_months"
  | "5_months"
  | "6_months"
  | "8_months"
  | "1_year"
  | "other";

export type MilestoneGiftStage =
  | "created"
  | "rating"
  | "gift_decision"
  | "final_status"
  | "closed"
  | "cancelled";

export type MilestoneGiftFinalStatus =
  | "delivered_to_employee"
  | "sent_to_store_awaiting_pickup"
  | "not_delivered_no_longer_with_company"
  | "not_delivered_other_reason";

export type MilestoneGiftQuestionType = "single_select" | "multi_select";

/* ── Questions ─────────────────────────────────────────────────────────── */

export interface MilestoneGiftQuestionOption {
  id: number;
  option_text: string;
  sort_order: number;
}

export interface MilestoneGiftQuestion {
  id: number;
  store_id: number | null;
  question_text: string;
  question_type: MilestoneGiftQuestionType;
  sort_order: number;
  is_active: boolean;
  options: MilestoneGiftQuestionOption[];
}

export interface MilestoneGiftQuestionsResponse {
  data: MilestoneGiftQuestion[];
}

export interface MilestoneGiftQuestionResponse {
  data: MilestoneGiftQuestion;
}

export interface MilestoneGiftOptionResponse {
  data: MilestoneGiftQuestionOption;
}

/* ── Question/Option admin payloads ────────────────────────────────────── */

export interface CreateMilestoneGiftQuestionPayload {
  question_text: string;
  question_type: MilestoneGiftQuestionType;
  sort_order?: number;
  /** null/omitted = global (all stores); a store id = store-specific */
  store_id?: number | null;
}

export interface UpdateMilestoneGiftQuestionPayload {
  question_text: string;
  question_type: MilestoneGiftQuestionType;
  sort_order?: number;
}

export interface MilestoneGiftOptionPayload {
  option_text: string;
  sort_order?: number;
}

/* ── Nested workflow records (returned inside the request detail) ───────── */

/** A selected option on a rating answer (wraps the underlying option). */
export interface MilestoneGiftSelectedOption {
  id: number;
  milestone_gift_rating_answer_id: number;
  milestone_gift_question_option_id: number;
  question_option: MilestoneGiftQuestionOption;
}

export interface MilestoneGiftRatingAnswer {
  id: number;
  milestone_gift_rating_id: number;
  milestone_gift_question_id: number;
  /** The question that was answered (no nested options here). */
  question: Pick<
    MilestoneGiftQuestion,
    "id" | "question_text" | "question_type" | "store_id"
  > | null;
  selected_options: MilestoneGiftSelectedOption[];
}

export interface MilestoneGiftRating {
  id: number;
  milestone_gift_request_id: number;
  user_id: number;
  additional_comments: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  answers: MilestoneGiftRatingAnswer[];
}

export interface MilestoneGiftDecision {
  id: number;
  milestone_gift_request_id: number;
  user_id: number;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  gift_description: string | null;
  /** API returns this as a numeric string (e.g. "123.00"). */
  gift_cost: number | string | null;
  delivery_date: string | null;
  sent_to_store: boolean | null;
  decided_at: string;
  created_at: string;
  updated_at: string;
}

export interface MilestoneGiftFinalStatusRecord {
  id: number;
  milestone_gift_request_id: number;
  user_id: number;
  status: MilestoneGiftFinalStatus;
  status_other_reason: string | null;
  confirmation_date: string | null;
  closing_notes: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MilestoneGiftEmployee {
  id: number;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
}

export interface MilestoneGiftUser {
  id: number;
  name: string;
  email?: string;
}

/**
 * The nested `milestone_gift_request` object surfaced inside a StoreRequest
 * from the unified `/v1/stores/{storeId}/requests` feed.
 */
export interface MilestoneGiftDetail {
  id: number;
  store_id: number;
  user_id: number;
  employee_id: number;
  milestone: Milestone;
  milestone_other: string | null;
  stage: MilestoneGiftStage;
  created_at: string;
  updated_at: string;
  employee: MilestoneGiftEmployee | null;
  user: MilestoneGiftUser | null;
  rating: MilestoneGiftRating | null;
  decision: MilestoneGiftDecision | null;
  final_status: MilestoneGiftFinalStatusRecord | null;
  store?: { id: number; store_number: string } | null;
}

/* ── Payloads ──────────────────────────────────────────────────────────── */

export interface CreateMilestoneGiftPayload {
  employee_id: number;
  milestone: Milestone;
  milestone_other?: string | null;
}

export interface MilestoneGiftRatingAnswerInput {
  question_id: number;
  option_ids: number[];
}

export interface SubmitMilestoneGiftRatingPayload {
  answers: MilestoneGiftRatingAnswerInput[];
  additional_comments?: string | null;
}

export interface MilestoneGiftDecisionPayload {
  is_cancelled: boolean;
  /* approve fields (required when is_cancelled === false) */
  gift_description?: string;
  gift_cost?: number;
  delivery_date?: string;
  sent_to_store?: boolean | null;
  /* cancel field (required when is_cancelled === true) */
  cancellation_reason?: string;
}

export interface MilestoneGiftFinalStatusPayload {
  status: MilestoneGiftFinalStatus;
  confirmation_date: string;
  status_other_reason?: string;
  close?: boolean;
  closing_notes?: string;
}
