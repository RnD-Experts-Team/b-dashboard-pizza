import type { Notification } from "@/types/notification.types";
import type { HiringActionTab } from "@/lib/store/hiring-action.store";
import type { PeriodType } from "@/types/cleaning.types";
import { isReportNotification } from "@/lib/notifications/notification-routing";

/**
 * What clicking a notification does, as pure data: which feature it belongs to
 * (`getNotificationFamily`), the label of its destination chip, and the parsers
 * that read its `action_url` / `data`. The navigation itself happens in
 * `components/notifications/use-open-notification.ts`, shared by the list rows
 * and the toast stack.
 */

/** The feature a clickable notification opens. */
export type NotificationFamily =
  | "announcement"
  | "calendar"
  | "debrief"
  | "hiring"
  | "employee"
  | "cleaning"
  | "report"
  | "maintenance"
  | "break"
  | "ticket";

/**
 * Only these explicitly-coded type families are clickable — an uncoded type
 * must never guess a navigation target, it just displays safely (null).
 */
export function getNotificationFamily(notification: Notification): NotificationFamily | null {
  const type = notification.type;
  if (type.startsWith("announcement")) return "announcement";
  if (type.startsWith("calendar_")) return "calendar";
  if (type.startsWith("data_entry_key")) return "debrief";
  if (
    type.startsWith("hiring_request") ||
    type.startsWith("shirt_milestone") ||
    type.startsWith("separation_request")
  ) {
    return "hiring";
  }
  if (type.startsWith("employee_promoted")) return "employee";
  if (type.startsWith("cleaning_")) return "cleaning";
  if (isReportNotification(notification)) return "report";
  if (type.startsWith("maintenance_")) return "maintenance";
  if (type.startsWith("break_")) return "break";
  if (type.startsWith("ticket_")) return "ticket";
  return null;
}

/** The destination chip shown on a clickable notification ("Announcements", …). */
export const NOTIFICATION_FAMILY_LABEL: Record<NotificationFamily, string> = {
  announcement: "Announcements",
  debrief: "Open Debrief",
  hiring: "Hiring Requests",
  employee: "Employees",
  break: "Breaks",
  ticket: "Tickets",
  maintenance: "Maintenance ticket",
  report: "Report Builder",
  calendar: "Calendar",
  cleaning: "Cleaning Chart",
};

/** Relative time string (simple, no deps): "Just now", "5m ago", "3h ago", "2d ago". */
export function getRelativeTime(timestamp: string, now: number = Date.now()): string {
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Strip HTML tags to render a plain-text preview.
 *
 * Parsed with `DOMParser`, whose documents are inert: nothing loads and no
 * handler runs. (Setting `innerHTML` on a detached element is NOT safe — an
 * `<img onerror=…>` in the body still fires.) Notification bodies are
 * server-written HTML, so this must never execute anything.
 */
export function stripHtml(html: string | null | undefined): string {
  const source = html ?? "";
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(source, "text/html");
    // Code and styles are not text the reader should see.
    doc.querySelectorAll("script, style, template").forEach((el) => el.remove());
    return doc.body.textContent ?? "";
  }
  return source
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, "");
}

/**
 * Parse a debrief action URL and extract keyId, date, and storeId.
 * e.g. /data-entries/keys/29?date=2026-05-22&store_id=03795-00001
 */
export function parseDebriefActionUrl(
  url: string
): { keyId: number; date: string; storeId: string } | null {
  try {
    const parsed = new URL(url, "http://x");
    const parts = parsed.pathname.split("/").filter(Boolean);
    // pathname segments: ["data-entries", "keys", "29"]
    const keyId = Number(parts[parts.length - 1]);
    const date = parsed.searchParams.get("date") ?? "";
    const storeId = parsed.searchParams.get("store_id") ?? "";
    if (!keyId || !date || !storeId) return null;
    return { keyId, date, storeId };
  } catch {
    return null;
  }
}

/**
 * Extract the store/period a cleaning-evaluation notification is about.
 *
 * The real payload (confirmed against a live notification) carries
 * `period_type`/`period_key`/`store` as direct fields on `notification.data`
 * — e.g. `{ period_type: "week", period_key: "2026-W36", store: "Store 1" }`
 * — NOT as a numeric `store_id` in `action_url`'s query string (an earlier,
 * unverified assumption this replaces). `store` here is a human label, not
 * an id — there's nothing to resolve it against, and the one place this
 * deep-links to (the "My Store" tab) already shows the viewing user's own
 * store regardless, so it's carried through only for display, never
 * required. Falls back to parsing `action_url`'s query string in case a
 * future payload omits the direct fields.
 */
export function parseCleaningActionUrl(
  notification: Notification
): { periodType: PeriodType; periodKey: string; store: string | null } | null {
  const data = notification.data;
  let periodType = typeof data?.period_type === "string" ? data.period_type : null;
  let periodKey = typeof data?.period_key === "string" ? data.period_key : null;
  let store = typeof data?.store === "string" ? data.store : null;

  if (!periodType || !periodKey) {
    try {
      const parsed = new URL(notification.action_url ?? "", "http://x");
      periodType ??= parsed.searchParams.get("period_type");
      periodKey ??= parsed.searchParams.get("period_key");
      store ??= parsed.searchParams.get("store");
    } catch {
      // fall through — handled by the validity check below
    }
  }

  if (periodType !== "week" && periodType !== "date") return null;
  if (!periodKey) return null;
  return { periodType, periodKey, store };
}

/** The `date` query param of a break notification's action_url, if it's a valid work date. */
export function parseBreakActionDate(actionUrl: string | null | undefined): string | null {
  if (!actionUrl) return null;
  try {
    const date = new URL(actionUrl, "http://x").searchParams.get("date");
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  } catch {
    return null;
  }
}

/**
 * Ticket action_url is `/toolbox/tickets/{id}` — or, for a reply,
 * `/toolbox/tickets/{id}#response-{responseId}`. It carries no store code;
 * the ticket page resolves that itself. Only the id and anchor are used.
 */
export function parseTicketActionUrl(
  actionUrl: string | null | undefined
): { ticketId: string; hash: string } | null {
  if (!actionUrl) return null;
  const m = /\/tickets\/(\d{1,12})(?:[/?][^#]*)?(#response-\d{1,12})?$/.exec(actionUrl);
  return m ? { ticketId: m[1], hash: m[2] ?? "" } : null;
}

const HIRING_SEGMENT_TO_TAB: Record<string, HiringActionTab> = {
  "hiring-requests": "hiring",
  "separation-requests": "separation",
  "shirt-milestones": "shirt_milestones",
};

/**
 * Parse a hiring/separation/shirt-milestone action URL into its tab, target id, and store number.
 * e.g. /hiring/store/03795-00001/separation-requests/42
 */
export function parseHiringActionUrl(
  url: string
): { tab: HiringActionTab; requestId: number; storeNumber: string } | null {
  try {
    const parsed = new URL(url, "http://x");
    const parts = parsed.pathname.split("/").filter(Boolean);
    // pathname segments: ["hiring", "store", "03795-00001", "separation-requests", "42"]
    if (parts.length < 5 || parts[0] !== "hiring" || parts[1] !== "store") return null;
    const storeNumber = parts[2];
    const tab = HIRING_SEGMENT_TO_TAB[parts[3]];
    const requestId = Number(parts[4]);
    if (!tab || !storeNumber || !requestId) return null;
    return { tab, requestId, storeNumber };
  } catch {
    return null;
  }
}

/**
 * Where a maintenance notification goes: the ticket's own page, with its store
 * so the page can authorise against it.
 *
 * Maintenance's notifications are role-based sends carrying type, title, body
 * and `action_url` (`/dashboard/maintenance-tickets/{id}?store={number}`), so
 * the ticket and store are read from that path; `ticket_id` / `store_number`
 * win when a notification has them. Falls back to the tickets list.
 */
export function maintenanceTicketHref(locale: string, notification: Notification): string {
  const data = notification.data ?? ({} as Notification["data"]);
  let ticketId = Number(data.ticket_id);
  let store = typeof data.store_number === "string" ? data.store_number : "";

  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    try {
      const url = new URL(notification.action_url ?? "", "http://x");
      const match = url.pathname.match(/\/maintenance-tickets\/(\d+)/);
      ticketId = match ? Number(match[1]) : NaN;
      store = store || url.searchParams.get("store") || "";
    } catch {
      ticketId = NaN;
    }
  }

  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    return `/${locale}/dashboard/maintenance-tickets`;
  }

  return `/${locale}/dashboard/maintenance-tickets/${ticketId}${store ? `?store=${encodeURIComponent(store)}` : ""}`;
}
