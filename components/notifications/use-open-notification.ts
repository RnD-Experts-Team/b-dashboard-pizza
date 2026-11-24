"use client";

import { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Notification } from "@/types/notification.types";
import { useNotificationStore } from "@/lib/store/notification.store";
import { useDebriefActionStore } from "@/lib/store/debrief-action.store";
import { useHiringActionStore } from "@/lib/store/hiring-action.store";
import { useCleaningActionStore } from "@/lib/store/cleaning-action.store";
import {
  getAnnouncementNotificationHref,
  getCalendarNotificationHref,
  getReportNotificationHref,
} from "@/lib/notifications/notification-routing";
import {
  getNotificationFamily,
  maintenanceTicketHref,
  parseBreakActionDate,
  parseCleaningActionUrl,
  parseDebriefActionUrl,
  parseHiringActionUrl,
  parseTicketActionUrl,
} from "@/lib/notifications/notification-actions";

/**
 * Opens what a notification is about — the debrief panel on its key, the
 * announcement, the ticket, the Calendar day… — and marks it read. One place
 * for the list rows in the bell drawer and the toast stack, so a click does
 * the same thing wherever it happens.
 *
 * `open` returns false (and does nothing) for a type with no coded target.
 */
export function useOpenNotification() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const openDebriefKey = useDebriefActionStore((s) => s.openDebriefKey);
  const openHiringRequest = useHiringActionStore((s) => s.openHiringRequest);
  const openCleaningEvaluation = useCleaningActionStore((s) => s.openCleaningEvaluation);

  const open = useCallback(
    (notification: Notification): boolean => {
      const family = getNotificationFamily(notification);
      if (!family) return false;
      if (notification.read_at === null) markAsRead(notification.id);

      switch (family) {
        case "announcement":
          router.push(getAnnouncementNotificationHref(locale, notification));
          break;
        case "calendar":
          router.push(getCalendarNotificationHref(locale, notification));
          break;
        case "debrief": {
          const parsed = parseDebriefActionUrl(notification.action_url ?? "");
          if (parsed) openDebriefKey(parsed.keyId, parsed.date, parsed.storeId);
          break;
        }
        case "hiring": {
          const parsed = parseHiringActionUrl(notification.action_url ?? "");
          if (parsed) openHiringRequest(parsed.tab, parsed.requestId, parsed.storeNumber);
          router.push(`/${locale}/dashboard/hiring-request`);
          break;
        }
        case "employee":
          router.push(`/${locale}/dashboard/employees`);
          break;
        case "cleaning": {
          const parsed = parseCleaningActionUrl(notification);
          if (parsed) openCleaningEvaluation(parsed.periodType, parsed.periodKey, parsed.store);
          router.push(`/${locale}/dashboard/cleaning-chart`);
          break;
        }
        case "report":
          router.push(getReportNotificationHref(notification.action_url, locale));
          break;
        case "maintenance":
          router.push(maintenanceTicketHref(locale, notification));
          break;
        case "break": {
          // action_url is `/toolbox/breaks?date={work_date}` — only the WORK date
          // is carried over; the path itself belongs to another app.
          const date = parseBreakActionDate(notification.action_url);
          router.push(
            `/${locale}/dashboard/break-logger${date ? `?date=${encodeURIComponent(date)}` : ""}`
          );
          break;
        }
        case "ticket": {
          const parsed = parseTicketActionUrl(notification.action_url);
          router.push(
            parsed
              ? `/${locale}/dashboard/tickets/${parsed.ticketId}${parsed.hash}`
              : `/${locale}/dashboard/tickets`
          );
          break;
        }
      }
      return true;
    },
    [router, locale, markAsRead, openDebriefKey, openHiringRequest, openCleaningEvaluation]
  );

  return { open };
}
