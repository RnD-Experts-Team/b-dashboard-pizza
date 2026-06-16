export interface WbrComplaint {
  id: number;
  external_entry_number: number;
  store_label: string;
  issue: string;
  suggestion: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  complaint_date: string;
  submitted_at: string;
  manager_informed: string | null;
  created_at: string;
  updated_at: string;
}

export interface WbrFeedback {
  id: number;
  external_entry_number: number;
  submitted_at: string;
  store_label: string;
  improvement_feedback: string | null;
  first_name: string;
  last_name: string;
  valued_respected_appreciated_rating: number | null;
  work_schedule_satisfaction_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface WbrMoneyOwed {
  id: number;
  form_id: string;
  store_manager_full_name: string;
  manager_consulted_full_name: string | null;
  employee_full_name: string;
  store_label: string;
  expense_date: string;
  expense_description: string | null;
  expenses_amount: string;
  group_manager_full_name: string | null;
  approve: string | null;
  notes: string | null;
  rejection_reason: string | null;
  bi_full_name: string | null;
  bi_approve: string | null;
  bi_notes: string | null;
  bi_rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface WbrHooksResponse {
  store: string;
  store_number: number;
  week_start: string;
  week_end: string;
  complaints: WbrComplaint[];
  feedbacks: WbrFeedback[];
  money_owed: WbrMoneyOwed[];
}
