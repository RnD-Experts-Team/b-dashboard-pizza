/**
 * Maintenance analytics -- GET /maintenance-analytics/{summary|activity|watchlist}.
 * Kept in the API's own snake_case: these shapes go straight to the page and
 * are not shared with anything else.
 */

export interface AnalyticsEnum {
  value: string;
  label: string;
}

export interface AnalyticsParams {
  /** Store numbers, e.g. "03795-00001". */
  stores: string[];
  /** UTC instants: the viewer's local midnights. `to` is exclusive. */
  from: string;
  to: string;
  recurringMin?: number;
  recurringDays?: number;
  untouchedDays?: number;
}

export interface AnalyticsCreatedTicket {
  ticket_id: number;
  store_number: string | null;
  created_at: string;
  creator: { id: number; name: string } | null;
  status: AnalyticsEnum;
  issues: {
    id: number;
    issue_id: number | null;
    title: string;
    priority: AnalyticsEnum;
    status: AnalyticsEnum;
    /** Set when this issue recurs at the store: how many tickets in the window. */
    recurring_count: number | null;
  }[];
}

export interface AnalyticsSummary {
  range: { from: string; to: string };
  stores: { id: number; store_number: string }[];
  kpis: {
    tickets_created: number;
    issues_created: number;
    issues_completed: number;
    open_tickets: number;
    untouched_tickets: number;
    recurring_issues: number;
    avg_hours_to_complete: number | null;
    /** Tickets with any change in the range. */
    changed_tickets: number;
  };
  created: AnalyticsCreatedTicket[];
  by_issue: { issue_id: number | null; title: string; count: number }[];
  by_store: { store_number: string; created: number; completed: number; open: number }[];
  by_status: { status: string; label: string; count: number }[];
  completion_by_issue: { issue_id: number | null; title: string; completed: number; avg_hours: number }[];
  recurring_window: { min: number; days: number };
  untouched_days: number;
}

/** What changed on a ticket in the range, read from the tables that record it. */
export interface AnalyticsTicketChanges {
  /** Opened inside the range. */
  opened: boolean;
  status_changes: {
    title: string | null;
    from: string | null;
    to: string;
    by: string | null;
    at: string;
  }[];
  /** Notes and files added in the range. Locked notes are never counted. */
  notes: number;
  files: number;
}

export interface AnalyticsActivityTicket {
  ticket_id: number;
  store_number: string | null;
  title: string | null;
  status: AnalyticsEnum | null;
  /** The last change to the ticket or anything on it. */
  updated_at: string;
  changes: AnalyticsTicketChanges;
}

export interface AnalyticsActivityPage {
  data: AnalyticsActivityTicket[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export interface AnalyticsUntouchedTicket {
  ticket_id: number;
  store_number: string | null;
  created_at: string;
  /** The last change to the ticket or one of its issues. */
  last_change_at: string;
  days_silent: number;
  status: AnalyticsEnum;
  open_issues: { id: number; issue_id: number | null; title: string; status: AnalyticsEnum }[];
}

export interface AnalyticsRecurring {
  store_id: number;
  store_number: string | null;
  issue_id: number;
  title: string;
  count: number;
  last_at: string | null;
}

export interface AnalyticsWatchlist {
  untouched: AnalyticsUntouchedTicket[];
  recurring: AnalyticsRecurring[];
  untouched_days: number;
  recurring_window: { min: number; days: number };
}
