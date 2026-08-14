import type { Notification } from "@/types/notification.types";

/**
 * Extract the first path segment from action_url (ignores trailing ID segments).
 * "/announcements/8" → "announcements"
 * "/announcements"   → "announcements"
 * null / ""          → null
 */
export function getPageSegment(actionUrl: string | null | undefined): string | null {
  if (!actionUrl) return null;
  const segment = actionUrl.split("/").filter(Boolean)[0];
  return segment ?? null;
}

/**
 * Map a notification to the dashboard page segment it belongs to, e.g.
 * "hiring-request" for `/{locale}/dashboard/hiring-request`. Mirrors the
 * routing branches in notification-item.tsx's handleClick — single source
 * of truth so the sidebar dot and click-routing never disagree.
 */
export function getNotificationPageSegment(notification: Notification): string | null {
  const { type, action_url } = notification;
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
  return getPageSegment(action_url);
}
