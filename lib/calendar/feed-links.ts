import { dayKey } from "./dates";
import type { CalendarEvent } from "./types";

/**
 * Where "Open" goes for a feed event: a dashboard page, picked by the event's
 * TYPE. Same rule as `lib/notifications/notification-routing.ts` — never guess
 * a page from the source's `link`, because several sources still send guessed
 * paths (FRONTEND_CALENDAR_GUIDE §10: `/schedule`, `/cleaning/tasks`,
 * `/data-entry`…). Query params are added only where the target page reads
 * them. A type with no page here gets no button.
 *
 * Returns a path WITHOUT the locale (`/dashboard/...`); `feedHref` adds it.
 */
function dashboardPath(ev: CalendarEvent): string | null {
  const day = dayKey(ev.start);
  const extra = ev.extra ?? {};
  switch (ev.feedType) {
    case "tech_visit":
    case "ticket_opened": {
      const ticket = extra.ticket_id;
      if (typeof ticket !== "number" && typeof ticket !== "string") return "/dashboard/maintenance-tickets";
      const qs = ev.store.code ? `?store=${encodeURIComponent(ev.store.code)}` : "";
      return `/dashboard/maintenance-tickets/${encodeURIComponent(String(ticket))}${qs}`;
    }
    // The Cleaning Chart opens its Due tab on `?tab=due&date=`.
    case "cleaning_day_summary":
    case "cleaning_task":
      return `/dashboard/cleaning-chart?tab=due&date=${day}`;
    case "cleaning_period_summary":
    case "cleaning_evaluation":
      return "/dashboard/cleaning-chart";
    case "dough_plan":
    case "dough_judgement":
      return "/dashboard/dough-sauce";
    // The Manager Hub tracks what's due per day (`?date=`).
    case "entry_day_summary":
    case "entry_due":
      return `/dashboard/due-keys?date=${day}`;
    case "weekly_goal":
      return "/dashboard/goals";
    case "shift_day":
    case "shift":
    case "actual_shift":
    case "time_off":
    case "manager_coverage":
      return "/dashboard/scheduling";
    case "birthday":
    case "last_working_day":
      return "/dashboard/employees";
    case "hiring_need":
      return "/dashboard/hiring-request";
    case "inventory_count":
      return "/dashboard/inventory/links";
    case "announcement":
      return "/dashboard/announcements";
    // The DSPR dashboard is the dashboard root.
    case "daily_sales":
      return "/dashboard";
    // A reminder points at whatever it reminds about, when that is one of our pages.
    case "reminder": {
      const target = extra.target_link;
      return typeof target === "string" && /^\/dashboard(\/|\?|$)/.test(target) ? target : null;
    }
    // Toolbox tasks and events have no page yet (phase 2).
    default:
      return null;
  }
}

/** The page without the locale (`/dashboard/...`), for places that add their own — a reminder's bell link. */
export function feedPath(ev: CalendarEvent): string | null {
  return ev.feedType ? dashboardPath(ev) : null;
}

/** Locale-prefixed href for an event's "Open" button, or null when it has no page. */
export function feedHref(ev: CalendarEvent, locale: string): string | null {
  if (!ev.feedType) return null;
  const path = dashboardPath(ev);
  return path ? `/${locale}${path}` : null;
}
