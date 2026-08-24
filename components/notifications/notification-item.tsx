"use client";

import { useRouter, useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/notification.types";
import { Button } from "@/components/ui/button";
import {
  Info,
  AlertTriangle,
  CheckCircle,
  Megaphone,
  Check,
  Bell,
  ExternalLink,
  KeyRound,
  Briefcase,
  Gift,
  TrendingUp,
  UserMinus,
  SprayCan,
} from "lucide-react";
import { useDebriefActionStore } from "@/lib/store/debrief-action.store";
import { useHiringActionStore, type HiringActionTab } from "@/lib/store/hiring-action.store";
import { useCleaningActionStore } from "@/lib/store/cleaning-action.store";
import type { PeriodType } from "@/types/cleaning.types";

/**
 * Parse a debrief action URL and extract keyId, date, and storeId.
 * e.g. /data-entries/keys/29?date=2026-05-22&store_id=03795-00001
 */
function parseDebriefActionUrl(
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
 * Parse a cleaning-evaluation action URL and extract the store/period to
 * deep-link into — e.g. /cleaning/evaluations?store_id=5&period_type=week&period_key=2026-W32
 */
function parseCleaningActionUrl(
  url: string
): { storeId: number; periodType: PeriodType; periodKey: string } | null {
  try {
    const parsed = new URL(url, "http://x");
    const storeId = Number(parsed.searchParams.get("store_id"));
    const periodType = parsed.searchParams.get("period_type");
    const periodKey = parsed.searchParams.get("period_key");
    if (!storeId || (periodType !== "week" && periodType !== "date") || !periodKey) return null;
    return { storeId, periodType, periodKey };
  } catch {
    return null;
  }
}

const HIRING_SEGMENT_TO_TAB: Record<string, HiringActionTab> = {
  "hiring-requests": "hiring",
  "separation-requests": "separation",
  "milestone-gift-requests": "milestone_gift",
};

/**
 * Parse a hiring/separation/milestone-gift action URL into its tab, request id, and store number.
 * e.g. /hiring/store/03795-00001/separation-requests/42
 */
function parseHiringActionUrl(
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
 * Derive icon & color from the API notification type string.
 * Common types: "announcement.created", "announcement.updated", etc.
 */
function getTypeVisuals(type: string) {
  if (type.startsWith("data_entry_key")) {
    return { Icon: KeyRound, bg: "bg-orange-500/10 text-orange-600 dark:text-orange-400" };
  }
  if (type.startsWith("announcement")) {
    return { Icon: Megaphone, bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400" };
  }
  if (type.startsWith("hiring_request")) {
    return { Icon: Briefcase, bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
  }
  if (type.startsWith("milestone_gift_request")) {
    return { Icon: Gift, bg: "bg-pink-500/10 text-pink-600 dark:text-pink-400" };
  }
  if (type.startsWith("employee_promoted")) {
    return { Icon: TrendingUp, bg: "bg-green-500/10 text-green-600 dark:text-green-400" };
  }
  if (type.startsWith("separation_request")) {
    return { Icon: UserMinus, bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  }
  if (type.includes("warning") || type.includes("alert")) {
    return { Icon: AlertTriangle, bg: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" };
  }
  if (type.includes("success") || type.includes("completed")) {
    return { Icon: CheckCircle, bg: "bg-green-500/10 text-green-600 dark:text-green-400" };
  }
  if (type.includes("error") || type.includes("fail")) {
    return { Icon: AlertTriangle, bg: "bg-destructive/10 text-destructive" };
  }
  if (type.includes("info")) {
    return { Icon: Info, bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
  }
  if (type.startsWith("cleaning_")) {
    return { Icon: SprayCan, bg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" };
  }
  return { Icon: Bell, bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
}

// Helper: relative time string (simple, no deps)
function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Strip HTML tags to render a plain-text preview */
function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return el.textContent || el.innerText || "";
  }
  return html.replace(/<[^>]*>/g, "");
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: number) => void;
  onNavigate?: () => void;
  /** Clamp the body preview to 2 lines (default). Set false to let the full
   * description wrap — used by the mobile bottom-sheet notification panel. */
  compact?: boolean;
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onNavigate,
  compact = true,
}: NotificationItemProps) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) || "en";
  const openDebriefKey = useDebriefActionStore((s) => s.openDebriefKey);
  const openHiringRequest = useHiringActionStore((s) => s.openHiringRequest);
  const openCleaningEvaluation = useCleaningActionStore((s) => s.openCleaningEvaluation);
  const isOnDueKeysPage = pathname?.includes("/due-keys") ?? false;

  const { Icon, bg } = getTypeVisuals(notification.type);
  const isUnread = notification.read_at === null;
  const isDebriefType = notification.type.startsWith("data_entry_key");
  const isAnnouncementType = notification.type.startsWith("announcement");
  const isHiringType =
    notification.type.startsWith("hiring_request") ||
    notification.type.startsWith("milestone_gift_request") ||
    notification.type.startsWith("separation_request");
  const isEmployeeType = notification.type.startsWith("employee_promoted");
  const isCleaningType = notification.type.startsWith("cleaning_");
  // Only these explicitly-coded type families are clickable — an uncoded
  // type must never guess a navigation target, it just displays safely.
  const isClickable =
    isDebriefType || isAnnouncementType || isHiringType || isEmployeeType || isCleaningType;

  function handleClick() {
    if (!isClickable) return;
    if (isDebriefType && isOnDueKeysPage) return;
    if (isUnread) onMarkAsRead(notification.id);
    onNavigate?.();

    if (isAnnouncementType) {
      router.push(`/${locale}/dashboard/announcements`);
      return;
    }

    if (isDebriefType) {
      const parsed = parseDebriefActionUrl(notification.action_url ?? "");
      if (parsed) {
        openDebriefKey(parsed.keyId, parsed.date, parsed.storeId);
      }
      return;
    }

    if (isHiringType) {
      const parsed = parseHiringActionUrl(notification.action_url ?? "");
      if (parsed) {
        openHiringRequest(parsed.tab, parsed.requestId, parsed.storeNumber);
      }
      router.push(`/${locale}/dashboard/hiring-request`);
      return;
    }

    if (isEmployeeType) {
      router.push(`/${locale}/dashboard/employees`);
      return;
    }

    if (isCleaningType) {
      const parsed = parseCleaningActionUrl(notification.action_url ?? "");
      if (parsed) {
        openCleaningEvaluation(parsed.storeId, parsed.periodType, parsed.periodKey);
      }
      router.push(`/${locale}/dashboard/cleaning-chart`);
      return;
    }
  }

  return (
    <div
      role={isClickable ? "button" : "listitem"}
      tabIndex={isClickable ? 0 : undefined}
      className={cn(
        "flex items-start gap-3 p-3 rounded-md transition-colors group",
        isClickable
          ? "cursor-pointer hover:bg-muted/80"
          : "cursor-default",
        isUnread && "bg-muted/50"
      )}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) handleClick();
      }}
    >
      {/* Icon */}
      <div className={cn("mt-0.5 shrink-0 rounded-full p-1.5", bg)}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm leading-tight",
          isUnread ? "font-semibold" : "font-normal text-muted-foreground"
        )}>
          {notification.title}
        </p>
        <p className={cn("text-xs text-muted-foreground mt-0.5", compact && "line-clamp-2")}>
          {stripHtml(notification.body)}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <p className="text-xs text-muted-foreground/70">
            {getRelativeTime(notification.created_at)}
          </p>
          {isClickable && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground/70">
                <ExternalLink className="h-2.5 w-2.5" />
                {isAnnouncementType
                  ? "Announcements"
                  : isDebriefType
                  ? "Open Debrief"
                  : isHiringType
                  ? "Hiring Requests"
                  : isEmployeeType
                  ? "Employees"
                  : "Cleaning Chart"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Mark as read button — visible on hover for unread only */}
      {isUnread && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsRead(notification.id);
          }}
          aria-label="Mark as read"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
