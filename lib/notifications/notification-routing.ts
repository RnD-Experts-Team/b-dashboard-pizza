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
 * Where an Announcements notification (`announcement.*`) goes: the Announcements
 * page, scrolled to that announcement's post when the notification carries its
 * id (`data.announcement_id`, read by the page as `?announcement=`). A missing or
 * malformed id opens the plain page. Only the id (digits) ever reaches the URL.
 */
export function getAnnouncementNotificationHref(locale: string, notification: Notification): string {
  const base = `/${locale}/dashboard/announcements`;
  const raw: unknown = notification.data?.announcement_id;
  const id =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+$/.test(raw)
        ? Number(raw)
        : null;
  return id !== null && Number.isSafeInteger(id) && id > 0 ? `${base}?announcement=${id}` : base;
}

/** The day a Calendar notification is about ("YYYY-MM-DD"): a `date` / `due_date` field, else the first ISO date in its text. */
function calendarNotificationDay(notification: Notification): string | null {
  const data = notification.data ?? {};
  for (const v of [data.date, data.due_date, data.due_on]) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  }
  // `calendar_assigned` says it in words: "… gave you a task, due 2026-11-19 17:00 UTC."
  return /\b(\d{4}-\d{2}-\d{2})\b/.exec(notification.body ?? "")?.[1] ?? null;
}

/**
 * Where a Calendar notification (`calendar_*`) takes you:
 * - `calendar_reminder` made from an event's card carries that event's page as
 *   `action_url` (`/dashboard/...`): followed, as long as it is an in-app
 *   dashboard path — never a URL taken from the notification;
 * - anything else — `calendar_assigned` ("New task: …" / "New event: …" for a
 *   "Chosen people" item, FRONTEND_CALENDAR_CHANGES 2026-11-18, whose
 *   `action_url` `/toolbox/calendar/{id}` is a Toolbox page, not ours), or a
 *   reminder with no page — opens the Calendar, on the item's day when the
 *   notification names one (the page ignores a `?date=` it can't read).
 */
export function getCalendarNotificationHref(locale: string, notification: Notification): string {
  const url = notification.action_url ?? "";
  if (/^\/dashboard(\/[\w%.~-]*)*(\?[^#\s]*)?$/.test(url)) return `/${locale}${url}`;
  const day = calendarNotificationDay(notification);
  return `/${locale}/dashboard/calendar${day ? `?date=${day}` : ""}`;
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
  // calendar_reminder (a Calendar reminder coming due) and calendar_assigned (a "Chosen
  // people" task or event given to you) belong to the Calendar page.
  if (type.startsWith("calendar_")) return "calendar";
  // report_ready / _failed / _delivery_failed / _schedule_paused open the run
  // page (or the schedules tab) of the Report Builder.
  if (REPORT_NOTIFICATION_TYPES.has(type)) return "report-builder";
  return null;
}
