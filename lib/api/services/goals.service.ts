import axios from "axios";
import type {
  ApiGoal,
  ApiGoalMetric,
  ApiGoalsListResponse,
  ApiGoalMetricsListResponse,
  Goal,
  GoalMetric,
  GoalsListResponse,
  CreateGoalPayload,
  UpdateGoalPayload,
  CreateGoalMetricPayload,
} from "@/types/goal.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error Handling                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export type GoalsErrorCode =
  | "NOT_AUTHENTICATED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export class GoalsError extends Error {
  readonly code: GoalsErrorCode;
  readonly retryable: boolean;
  readonly retryAfter?: number;

  constructor(message: string, code: GoalsErrorCode, retryAfter?: number) {
    super(message);
    this.name = "GoalsError";
    this.code = code;
    this.retryAfter = retryAfter;
    this.retryable = ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR"].includes(code);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Transform helpers                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function transformApiMetric(raw: ApiGoalMetric): GoalMetric {
  return {
    id: raw.id,
    name: raw.name,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformGoal(raw: ApiGoal): Goal {
  return {
    id: raw.id,
    goalMetricId: raw.goal_metric_id,
    storeId: raw.store_id,
    weekStartDate: raw.week_start_date,
    weekEndDate: raw.week_end_date,
    goal: Number(raw.goal),
    metric: {
      id: raw.metric.id,
      name: raw.metric.name,
      createdAt: raw.metric.created_at,
      updatedAt: raw.metric.updated_at,
    },    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function normaliseGoalsList(raw: ApiGoalsListResponse): GoalsListResponse {
  return {
    data: (raw.data ?? []).map(transformGoal),
    meta: {
      currentPage: raw.current_page,
      from: raw.from,
      lastPage: raw.last_page,
      perPage: raw.per_page,
      to: raw.to,
      total: raw.total,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Auth helper                                                             */
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

/* ────────────────────────────────────────────────────────────────────────── */
/*  Axios error → GoalsError                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function handleAxiosError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
    const msg =
      data?.error?.message ||
      data?.message ||
      err.message ||
      "An unexpected error occurred.";

    if (status === 401) throw new GoalsError(msg, "NOT_AUTHENTICATED");
    if (status === 403) throw new GoalsError(msg, "FORBIDDEN");
    if (status === 404) throw new GoalsError(msg, "NOT_FOUND");
    if (status === 422) throw new GoalsError(msg, "VALIDATION_ERROR");
    if (status === 429) {
      const retryAfter = Number(err.response?.headers?.["retry-after"]) || undefined;
      throw new GoalsError(msg, "RATE_LIMITED", retryAfter);
    }
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
      throw new GoalsError("The request timed out. Please try again.", "TIMEOUT");
    }
    if (!err.response) {
      throw new GoalsError("Network error. Please check your connection.", "NETWORK_ERROR");
    }
    if (status && status >= 500) {
      throw new GoalsError("Server error. Please try again later.", "SERVER_ERROR");
    }
    throw new GoalsError(msg, "UNKNOWN");
  }
  throw new GoalsError(
    err instanceof Error ? err.message : "An unexpected error occurred.",
    "UNKNOWN"
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const goalsService = {
  /**
   * Fetch a page of goals for a store.
   */
  async getGoals(storeId: string, page = 1, signal?: AbortSignal): Promise<GoalsListResponse> {
    const token = getToken();
    if (!token) throw new GoalsError("You must be logged in to view goals.", "NOT_AUTHENTICATED");

    try {
      const response = await axios.get<ApiGoalsListResponse>(
        `/api/data/stores/${encodeURIComponent(storeId)}/goals`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          params: { page },
          timeout: 15_000,
          signal,
        }
      );
      return normaliseGoalsList(response.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Create a new goal for a store.
   */
  async createGoal(storeId: string, payload: CreateGoalPayload): Promise<Goal> {
    const token = getToken();
    if (!token) throw new GoalsError("You must be logged in to create a goal.", "NOT_AUTHENTICATED");

    try {
      const response = await axios.post<ApiGoal>(
        `/api/data/stores/${encodeURIComponent(storeId)}/goals`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 15_000,
        }
      );
      return transformGoal(response.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Update an existing goal.
   */
  async updateGoal(storeId: string, goalId: number, payload: UpdateGoalPayload): Promise<Goal> {
    const token = getToken();
    if (!token) throw new GoalsError("You must be logged in to update a goal.", "NOT_AUTHENTICATED");

    try {
      const response = await axios.put<ApiGoal>(
        `/api/data/stores/${encodeURIComponent(storeId)}/goals/${goalId}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 15_000,
        }
      );
      return transformGoal(response.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Delete a goal.
   */
  async deleteGoal(storeId: string, goalId: number): Promise<void> {
    const token = getToken();
    if (!token) throw new GoalsError("You must be logged in to delete a goal.", "NOT_AUTHENTICATED");

    try {
      await axios.delete(
        `/api/data/stores/${encodeURIComponent(storeId)}/goals/${goalId}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 15_000,
        }
      );
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /* ── Goal Metrics ──────────────────────────────────────────────────────── */

  /**
   * Fetch all goal metrics.
   */
  async getGoalMetrics(signal?: AbortSignal): Promise<GoalMetric[]> {
    const token = getToken();
    if (!token) throw new GoalsError("You must be logged in to view goal metrics.", "NOT_AUTHENTICATED");

    try {
      const response = await axios.get<ApiGoalMetricsListResponse>(
        `/api/data/goal-metrics`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 15_000,
          signal,
        }
      );
      return (response.data ?? []).map(transformApiMetric);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Create a new goal metric.
   */
  async createGoalMetric(payload: CreateGoalMetricPayload): Promise<GoalMetric> {
    const token = getToken();
    if (!token) throw new GoalsError("You must be logged in to create a goal metric.", "NOT_AUTHENTICATED");

    try {
      const response = await axios.post<ApiGoalMetric>(
        `/api/data/goal-metrics`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 15_000,
        }
      );
      return transformApiMetric(response.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Delete a goal metric.
   */
  async deleteGoalMetric(goalMetricId: number): Promise<void> {
    const token = getToken();
    if (!token) throw new GoalsError("You must be logged in to delete a goal metric.", "NOT_AUTHENTICATED");

    try {
      await axios.delete(
        `/api/data/goal-metrics/${goalMetricId}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 15_000,
        }
      );
    } catch (err) {
      return handleAxiosError(err);
    }
  },
};
