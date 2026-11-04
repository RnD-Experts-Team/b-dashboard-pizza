import { isValidLocale } from "@/lib/i18n/config";
import type { Notification } from "@/types/notification.types";

/**
 * The Data service's Report Builder notifications (in-app, channel web). Exact
 * types, not a prefix: `report_` is too generic a family to claim wholesale.
 * All four open the run page (or the schedules tab) from `action_url`.
 */
export const REPORT_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  "report_ready",
  "report_failed",
  "report_delivery_failed",
  "report_schedule_paused",
]);

export function isReportNotification(notification: Notification): boolean {
  return REPORT_NOTIFICATION_TYPES.has(notification.type);
}

const REPORT_BUILDER_PATH = /^\/dashboard\/report-builder(?:\/runs\/[^/]+)?\/?$/;

/**
 * Where a Report Builder notification goes. `action_url` is
 * `{dashboard}/dashboard/report-builder/runs/{ulid}` or
 * `{dashboard}/dashboard/report-builder?tab=schedules`, absolute — or, when the
 * backend's dashboard URL is unset, a bare `/dashboard/...` path with no
 * locale. Only the path and query are used (the origin is never followed, so a
 * foreign host cannot redirect the browser), the current locale is added when
 * the path has none, and anything that is not the report-builder list or a run
 * page falls back to the list.
 */
export function getReportNotificationHref(
  actionUrl: string | null | undefined,
  locale: string
): string {
  const fallback = `/${locale}/dashboard/report-builder`;
  if (!actionUrl) return fallback;
  try {
    const url = new URL(actionUrl, "http://x");
    const parts = url.pathname.split("/").filter(Boolean);
    const hasLocale = parts.length > 0 && isValidLocale(parts[0]);
    const pathLocale = hasLocale ? parts[0] : locale;
    const rest = `/${(hasLocale ? parts.slice(1) : parts).join("/")}`;
    if (!REPORT_BUILDER_PATH.test(rest)) return fallback;
    return `/${pathLocale}${rest}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Map a notification to the dashboard page segment it belongs to, e.g.
 * "hiring-request" for `/{locale}/dashboard/hiring-request`. Mirrors the
 * routing branches in notification-item.tsx's handleClick — single source
 * of truth so the sidebar dot and click-routing never disagree.
 *
 * Only explicitly-recognized types return a segment. A type with no branch
 * here returns null on purpose — an uncoded type must never guess a sidebar
 * page (or a click target) from action_url; it should just display safely
 * until someone adds an explicit branch for it.
 */
export function getNotificationPageSegment(notification: Notification): string | null {
  const { type } = notification;
  if (type.startsWith("announcement")) return "announcements";
  // data_entry_key notifications (debrief due soon) open the floating debrief
  // panel, not a dedicated page — the Manager Hub (`/dashboard/due-keys`) is
  // the page that tracks what's due, so the sidebar dot goes there.
  if (type.startsWith("data_entry_key")) return "due-keys";
  if (
    type.startsWith("hiring_request") ||
    type.startsWith("shirt_milestone") ||
    type.startsWith("separation_request")
  ) {
    return "hiring-request";
  }
  if (type.startsWith("employee_promoted")) return "employees";
  // cleaning_task_created / cleaning_task_completed / cleaning_evaluation_ready
  // all deep-link into the Cleaning Chart tabs rather than a dedicated page.
  if (type.startsWith("cleaning_")) return "cleaning-chart";
  // break_milestone_reached / break_allowance_exceeded open the Breaks day view.
  if (type.startsWith("break_")) return "break-logger";
  // ticket_created / _responded / _fixed / _closed / _reopened /
  // _status_changed / _participant_added all open the ticket page.
  if (type.startsWith("ticket_")) return "tickets";
  // maintenance_ticket_created / _updated open the maintenance ticket.
  if (type.startsWith("maintenance_")) return "maintenance-tickets";
  // calendar_reminder (a Calendar reminder coming due) belongs to the Calendar page.
  if (type.startsWith("calendar_")) return "calendar";
  // report_ready / _failed / _delivery_failed / _schedule_paused open the run
  // page (or the schedules tab) of the Report Builder.
  if (REPORT_NOTIFICATION_TYPES.has(type)) return "report-builder";
  return null;
}
