/* ────────────────────────────────────────────────────────────────────────── */
/*  Goal Types                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/** Raw API shape (snake_case) */
export interface ApiGoalMetric {
  id: number;
  name: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface ApiGoal {
  id: number;
  goal_metric_id: number;
  store_id: string;
  week_start_date: string;
  week_end_date: string;
  goal: number | string;
  metric: ApiGoalMetric;
  created_at: string | null;
  updated_at: string | null;
}

/** Flat paginated response (pagination fields at root, not under meta) */
export interface ApiGoalsListResponse {
  data: ApiGoal[];
  current_page: number;
  from: number | null;
  last_page: number;
  path: string;
  per_page: number;
  to: number | null;
  total: number;
  first_page_url: string | null;
  last_page_url: string | null;
  next_page_url: string | null;
  prev_page_url: string | null;
  links: Array<{ url: string | null; label: string; page: number | null; active: boolean }>;
}

/** Normalised frontend shape (camelCase) */
export interface GoalMetric {
  id: number;
  name: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Goal {
  id: number;
  goalMetricId: number;
  storeId: string;
  weekStartDate: string;
  weekEndDate: string;
  goal: number;
  metric: GoalMetric;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface GoalsListResponse {
  data: Goal[];
  meta: {
    currentPage: number;
    from: number | null;
    lastPage: number;
    perPage: number;
    to: number | null;
    total: number;
  };
}

/** POST /stores/{store_id}/goals */
export interface CreateGoalPayload {
  goal: number;
  goal_metric_id: number;
  week_start_date: string;
  week_end_date: string;
}

/** PUT /stores/{store_id}/goals/{goal_id} */
export interface UpdateGoalPayload {
  goal: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Goal Metrics (standalone resource)                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/** GET /goal-metrics — raw API array item */
export type ApiGoalMetricsListResponse = ApiGoalMetric[];

/** POST /goal-metrics */
export interface CreateGoalMetricPayload {
  name: string;
}
