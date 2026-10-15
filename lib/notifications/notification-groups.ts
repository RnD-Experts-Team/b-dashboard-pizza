import {
  Briefcase,
  Bell,
  Coffee,
  KeyRound,
  Megaphone,
  MessageSquareWarning,
  SprayCan,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { Notification } from "@/types/notification.types";

export type NotificationGroupKey =
  | "debrief"
  | "hiring"
  | "cleaning"
  | "breaks"
  | "tickets"
  | "announcements"
  | "employees"
  | "other";

export interface NotificationGroup {
  key: NotificationGroupKey;
  label: string;
  icon: LucideIcon;
}

/** Display order of the panel's filter chips. */
export const NOTIFICATION_GROUPS: readonly NotificationGroup[] = [
  { key: "debrief", label: "Debrief", icon: KeyRound },
  { key: "hiring", label: "Hiring", icon: Briefcase },
  { key: "cleaning", label: "Cleaning", icon: SprayCan },
  { key: "breaks", label: "Breaks", icon: Coffee },
  { key: "tickets", label: "Tickets", icon: MessageSquareWarning },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "employees", label: "Employees", icon: TrendingUp },
  { key: "other", label: "Other", icon: Bell },
];

/**
 * Which filter chip a notification belongs to. Explicit type prefixes only,
 * the same families notification-item.tsx and notification-routing.ts
 * recognise; anything else lands in "other" so it stays reachable.
 */
export function getNotificationGroupKey(notification: Notification): NotificationGroupKey {
  const { type } = notification;
  if (type.startsWith("data_entry_key")) return "debrief";
  if (
    type.startsWith("hiring_request") ||
    type.startsWith("shirt_milestone") ||
    type.startsWith("separation_request")
  ) {
    return "hiring";
  }
  if (type.startsWith("cleaning_")) return "cleaning";
  if (type.startsWith("break_")) return "breaks";
  if (type.startsWith("ticket_") || type.startsWith("maintenance_")) return "tickets";
  if (type.startsWith("announcement")) return "announcements";
  if (type.startsWith("employee_promoted")) return "employees";
  return "other";
}

export interface NotificationGroupCount {
  total: number;
  unread: number;
}

/** Total and unread notification counts per group; groups with none are absent. */
export function countByGroup(
  notifications: readonly Notification[]
): Map<NotificationGroupKey, NotificationGroupCount> {
  const counts = new Map<NotificationGroupKey, NotificationGroupCount>();
  for (const notification of notifications) {
    const key = getNotificationGroupKey(notification);
    const entry = counts.get(key) ?? { total: 0, unread: 0 };
    entry.total += 1;
    if (notification.read_at === null) entry.unread += 1;
    counts.set(key, entry);
  }
  return counts;
}
