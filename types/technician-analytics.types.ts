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
  rating: number | null;
  deleted_at: string | null;
  paid: string;
  pay_days: number;
  visits: number;
  hours: TechnicianHours;
  issues_worked: number;
  stores_served: number;
  last_worked_at: string | null;
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
  /** What no store carries: a payment lump sum, payment gas / money owed, unassigned parts. */
  payment_level: boolean;
  amount: string;
  lines: number;
}

export interface TechnicianPaidByKind {
  hourly_labour: string;
  lump_sums: string;
  gas: string;
  money_owed: string;
  parts_reimbursed: string;
}

export interface TechnicianPaySheet {
  daily_pay_entry_id: number;
  daily_pay_payment_id: number;
  /** "YYYY-MM-DD", the sheet's day. */
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

export interface TechnicianWorkVisit {
  attendance_entry_id: number;
  start: string;
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
  };
  paid_by_store: TechnicianPaidByStore[];
  paid_by_kind: TechnicianPaidByKind;
  pay_sheets: TechnicianPaySheet[];
  work_by_store: TechnicianWorkByStore[];
  work_by_issue: TechnicianWorkByIssue[];
  work_log: TechnicianWorkVisit[];
}
