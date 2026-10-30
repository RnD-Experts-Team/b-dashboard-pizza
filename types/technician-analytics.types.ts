/**
 * Technician analytics -- GET /technician-analytics and
 * GET /technicians/{id}/analytics. Kept in the API's own snake_case, like the
 * maintenance analytics: these shapes go straight to the Technicians pages.
 *
 * Money arrives as decimal strings ("160.00"); hours as numbers.
 */

export interface TechnicianAnalyticsParams {
  /** UTC instants: the viewer's local midnights. `to` is exclusive. Work is compared on these. */
  from: string;
  to: string;
  /** Local days, both included. Pay (a pay sheet's date) is compared on these. */
  dateFrom: string;
  dateTo: string;
  /** Store numbers; empty = all. */
  stores?: string[];
  issueIds?: number[];
  categoryIds?: number[];
}

export interface TechnicianHours {
  work: number;
  travel: number;
  parts_run: number;
  /** Tracked, never paid. */
  break: number;
}

export interface TechnicianOverviewRow {
  id: number;
  name: string;
  phone: string | null;
  location: string | null;
  category: { id: number; name: string } | null;
  coverage_count: number;
  /** The average of the per-issue ratings ("4.5"), or null. */
  rating: number | string | null;
  emergency_available?: boolean;
  deleted_at: string | null;
  paid: string;
  pay_days: number;
  visits: number;
  hours: TechnicianHours;
  issues_worked: number;
  stores_served: number;
  /** The latest clocked visit not paid yet (an instant). */
  last_worked_at: string | null;
  /** The latest pay sheet with work on it ("YYYY-MM-DD"). */
  last_pay_date: string | null;
}

export interface TechniciansOverview {
  range: { from: string; to: string; date_from: string; date_to: string };
  /** A store or issue filter applies: money is read from the matching pay lines only. */
  filtered_money: boolean;
  technicians: TechnicianOverviewRow[];
  totals: { paid: string; visits: number; hours: TechnicianHours; technicians_worked: number };
}

export interface TechnicianPaidByStore {
  store_id: number | null;
  store_number: string | null;
  other_store: string | null;
  /** v2: parts bought for the shelf -- the line is for a storage location, not a store. */
  storage_location?: { id: number; name: string } | null;
  /** v1 only: what no store carried (a payment lump sum, payment gas / money owed). */
  payment_level?: boolean;
  amount: string;
  lines: number;
}

/**
 * Money per payment line type. v2 keys are the line types (hourly, fixed,
 * inspection, parts, gas, other -- every one present); v1 sent hourly_labour,
 * lump_sums, gas, money_owed, parts_reimbursed.
 */
export type TechnicianPaidByKind = Record<string, string>;

/** One payment to the technician in the range (v2), or a v1 pay sheet. */
export interface TechnicianPaySheet {
  /** v2: the payment. */
  payment_id?: number;
  method?: string | null;
  invoice_number?: string | null;
  /** v1 only. */
  daily_pay_entry_id?: number;
  daily_pay_payment_id?: number;
  /** "YYYY-MM-DD", the payment's (or sheet's) day. */
  date: string;
  stores: string[];
  amount: string;
}

export interface TechnicianWorkByStore {
  store: string;
  visits: number;
  hours: number;
  issues: number;
}

export interface TechnicianWorkByIssue {
  issue_id: number | null;
  title: string;
  visits: number;
  tickets: number;
  hours: number;
}

/**
 * One piece of work: a day's work at a store from a pay sheet, or a visit
 * clocked in and not on a pay sheet yet.
 */
export interface TechnicianWorkVisit {
  /** v2: "session" -- one clock-in → clock-out on a trip. v1: "pay_sheet" | "visit". */
  source: "session" | "pay_sheet" | "visit";
  /** v2: the trip and session the work was clocked on. */
  trip_id?: number | null;
  trip_session_id?: number | null;
  attendance_entry_id?: number | null;
  daily_pay_entry_id?: number | null;
  /** v1: the pay sheet's day ("YYYY-MM-DD"); null (or absent) for a clocked session. */
  date?: string | null;
  /** A visit's clock-in; null for a pay-sheet day. */
  start: string | null;
  end: string | null;
  stores: string[];
  tickets: { ticket_id: number; store_number: string | null; title: string }[];
  hours: TechnicianHours;
  /** On a pay sheet already. */
  paid: boolean;
}

export interface TechnicianAnalytics {
  range: { from: string; to: string; date_from: string; date_to: string };
  filtered_money: boolean;
  kpis: {
    paid: string;
    paid_all_time: string;
    pay_days: number;
    visits: number;
    hours: TechnicianHours;
    issues_worked: number;
    issues_assigned: number;
    stores_served: number;
    parts_bought: number;
    parts_bought_amount: string;
    last_worked_at: string | null;
    last_pay_date: string | null;
  };
  paid_by_store: TechnicianPaidByStore[];
  paid_by_kind: TechnicianPaidByKind;
  pay_sheets: TechnicianPaySheet[];
  work_by_store: TechnicianWorkByStore[];
  work_by_issue: TechnicianWorkByIssue[];
  work_log: TechnicianWorkVisit[];
}
