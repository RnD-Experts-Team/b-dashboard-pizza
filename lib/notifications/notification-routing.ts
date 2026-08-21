import type { Notification } from "@/types/notification.types";

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
  // data_entry_key notifications open a debrief modal, not a dedicated page —
  // "keys" is the closest related sidebar item.
  if (type.startsWith("data_entry_key")) return "keys";
  if (
    type.startsWith("hiring_request") ||
    type.startsWith("milestone_gift_request") ||
    type.startsWith("separation_request")
  ) {
    return "hiring-request";
  }
  if (type.startsWith("employee_promoted")) return "employees";
  // cleaning_task_created / cleaning_task_completed / cleaning_evaluation_ready
  // all deep-link into the Cleaning Chart tabs rather than a dedicated page.
  if (type.startsWith("cleaning_")) return "cleaning-chart";
  return null;
}
