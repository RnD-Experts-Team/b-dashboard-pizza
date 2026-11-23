import type { Announcement } from "@/types/announcement.types";
import { parseDateOrNull } from "@/lib/utils/date-display";

/**
 * Where an announcement is in its life, and how to print its window.
 *
 * `starts_at` / `ends_at` are both nullable on the wire: null start = live as
 * soon as it is active, null end = never expires.
 */

export type AnnouncementStatus = "live" | "scheduled" | "expired" | "inactive";

export const ANNOUNCEMENT_STATUSES: readonly AnnouncementStatus[] = [
  "live",
  "scheduled",
  "expired",
  "inactive",
];

type StatusFields = Pick<Announcement, "is_active" | "starts_at" | "ends_at">;

/**
 * live       active, inside its window (or the window is open-ended)
 * scheduled  active, but it starts in the future
 * expired    active, but its end has passed
 * inactive   switched off, whatever its dates say
 */
export function announcementStatus(
  a: StatusFields,
  now: Date | number = Date.now(),
): AnnouncementStatus {
  if (!a.is_active) return "inactive";
  const t = typeof now === "number" ? now : now.getTime();
  const start = parseDateOrNull(a.starts_at);
  const end = parseDateOrNull(a.ends_at);
  if (start && start.getTime() > t) return "scheduled";
  if (end && end.getTime() < t) return "expired";
  return "live";
}

/** Counts per status, plus `all`, for the admin tabs. */
export function countByStatus(
  items: readonly StatusFields[],
  now: Date | number = Date.now(),
): Record<AnnouncementStatus | "all", number> {
  const counts: Record<AnnouncementStatus | "all", number> = {
    all: items.length,
    live: 0,
    scheduled: 0,
    expired: 0,
    inactive: 0,
  };
  for (const item of items) counts[announcementStatus(item, now)]++;
  return counts;
}

export interface WindowLabels {
  /** Shown when there is no start date. */
  noStart: string;
  /** Shown when there is no end date. */
  noEnd: string;
}

const DEFAULT_WINDOW_LABELS: WindowLabels = {
  noStart: "Starts now",
  noEnd: "No end date",
};

/** `{ start, end }` as dates, either of which may be null. */
export function announcementWindow(a: Pick<Announcement, "starts_at" | "ends_at">): {
  start: Date | null;
  end: Date | null;
} {
  return { start: parseDateOrNull(a.starts_at), end: parseDateOrNull(a.ends_at) };
}

/**
 * "Nov 20, 2026 – Nov 27, 2026", "Starts now – Nov 27, 2026",
 * "Nov 20, 2026 – No end date". Null-safe on both ends; pass translated
 * `labels` from the UI.
 */
export function formatWindow(
  a: Pick<Announcement, "starts_at" | "ends_at">,
  locale?: string,
  labels: WindowLabels = DEFAULT_WINDOW_LABELS,
): string {
  const { start, end } = announcementWindow(a);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const from = start ? fmt.format(start) : labels.noStart;
  const to = end ? fmt.format(end) : labels.noEnd;
  return `${from} – ${to}`;
}
