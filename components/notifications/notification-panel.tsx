"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useNotificationStore } from "@/lib/store/notification.store";
import { useNotificationUiStore } from "@/lib/store/notification-ui.store";
import { NotificationItem } from "@/components/notifications/notification-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CheckCheck, Bell, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NOTIFICATION_GROUPS,
  countByGroup,
  getNotificationGroupKey,
  type NotificationGroup,
  type NotificationGroupKey,
} from "@/lib/notifications/notification-groups";
import { groupByDay } from "@/lib/notifications/day-groups";
import {
  enterClass,
  enterDelay,
  type EnterMode,
} from "@/components/notifications/enter-animation";

/** One filter at a time: everything, only unread, or one type of notification. */
type Filter = "all" | "unread" | NotificationGroupKey;

interface NotificationPanelProps {
  /** Closes the drawer after a row opens its target. */
  onClose?: () => void;
}

/** The sticky "Today / Yesterday / Earlier" label; it comes in like the cards. */
function DayLabel({
  children,
  index,
  enter,
}: {
  children: React.ReactNode;
  index: number;
  enter: EnterMode;
}) {
  const [mode] = useState(enter);
  return (
    <div
      role="heading"
      aria-level={3}
      className={cn(
        "sticky top-0 z-10 bg-background px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        enterClass(mode)
      )}
      style={{ animationDelay: enterDelay(mode, index) }}
    >
      {children}
    </div>
  );
}

/** Filter-row pieces slide in from the inline-end edge, a touch apart. */
function chipEnter(i: number) {
  return {
    className: enterClass("build"),
    style: { animationDelay: `${70 + i * 30}ms` },
  };
}

function UnreadDot() {
  return (
    <span
      aria-hidden
      className="size-1.5 shrink-0 rounded-full bg-destructive animate-in fade-in-0 zoom-in-50 duration-200 motion-reduce:animate-none"
    />
  );
}

/**
 * The list inside the bell's drawer (`notification-drawer.tsx`): fills the
 * drawer's height — one filter row (All, Unread, the type chips — one lit at a
 * time — and mark all as read) and the notifications as cards grouped by day.
 */
export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const t = useTranslations("notifications");
  const { notifications, unreadCount, isLoading, error, markAsRead, markAllAsRead, fetchNotifications } =
    useNotificationStore();
  const arrivedIds = useNotificationUiStore((s) => s.arrivedIds);
  // The drawer was just opened: build the panel up. Afterwards (a filter
  // change, a new row) things only fade, so the big entrance doesn't replay.
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setIntro(false), 1000);
    return () => window.clearTimeout(id);
  }, []);
  const enter: EnterMode = intro ? "build" : "fade";
  const [selected, setSelected] = useState<Filter>("all");

  useEffect(() => {
    const ctrl = new AbortController();
    fetchNotifications(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchNotifications]);

  const groupCounts = useMemo(() => countByGroup(notifications), [notifications]);
  const visibleGroups = NOTIFICATION_GROUPS.filter((g) => groupCounts.has(g.key));

  // The chosen type can vanish (e.g. its notifications get deleted upstream) —
  // fall back to "all" rather than showing an empty list with no chip lit.
  const filter: Filter =
    selected === "all" || selected === "unread" || groupCounts.has(selected) ? selected : "all";

  const shown = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => n.read_at === null);
    return notifications.filter((n) => getNotificationGroupKey(n) === filter);
  }, [notifications, filter]);
  const dayGroups = useMemo(() => groupByDay(shown), [shown]);

  const groupLabel = NOTIFICATION_GROUPS.find((g) => g.key === filter)?.label;
  const emptyText =
    filter === "unread"
      ? t("emptyUnread")
      : groupLabel
      ? t("emptyGroup", { group: groupLabel })
      : t("emptyAll");

  // Screen readers: say what just arrived while the drawer is open.
  const latestArrival = arrivedIds.length
    ? notifications.find((n) => n.id === arrivedIds[arrivedIds.length - 1])
    : undefined;
  const EmptyIcon = filter === "unread" ? CheckCheck : Bell;

  // The filter row, in order. Only types that have notifications are listed;
  // their red dot says "something unread in here".
  const chips: Array<{
    key: Filter;
    label: string;
    icon: NotificationGroup["icon"] | null;
    count?: number;
    dot?: boolean;
  }> = [
    { key: "all", label: t("all"), icon: null },
    { key: "unread", label: t("unread"), icon: null, count: unreadCount },
    ...visibleGroups.map((g) => ({
      key: g.key as Filter,
      label: g.label,
      icon: g.icon,
      dot: (groupCounts.get(g.key)?.unread ?? 0) > 0,
    })),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <span className="sr-only" role="status" aria-live="polite">
        {latestArrival?.title ?? ""}
      </span>

      {/* Loading state */}
      {isLoading && notifications.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {error && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => fetchNotifications()}>
            {t("retry")}
          </Button>
        </div>
      )}

      {!isLoading || notifications.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* One filter row; exactly one chip is lit. */}
          {notifications.length > 0 && (
            <div className="flex shrink-0 items-center gap-1 border-b ps-3 pe-2">
              <div
                role="group"
                aria-label={t("filterLabel")}
                className="flex min-w-0 flex-1 items-center gap-1.5 no-scrollbar overflow-x-auto py-2"
              >
                {chips.map((c, ci) => {
                  const active = filter === c.key;
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelected(c.key)}
                      style={chipEnter(ci).style}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium outline-none transition-colors pointer-coarse:py-2",
                        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        chipEnter(ci).className,
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {Icon && <Icon className="size-3.5" />}
                      {c.label}
                      {c.count !== undefined && c.count > 0 && (
                        <span className="tabular-nums opacity-70">{c.count}</span>
                      )}
                      {c.dot && <UnreadDot />}
                      {c.dot && <span className="sr-only">{t("hasUnread")}</span>}
                    </button>
                  );
                })}
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  style={chipEnter(chips.length).style}
                  className={cn(
                    "size-8 shrink-0 text-muted-foreground hover:text-foreground pointer-coarse:size-10",
                    chipEnter(0).className
                  )}
                  onClick={markAllAsRead}
                  aria-label={t("markAllRead")}
                  title={t("markAllRead")}
                >
                  <CheckCheck className="size-4" />
                </Button>
              )}
            </div>
          )}

          {/* Radix wraps the content in a `display: table` box, which grows to fit
              unbreakable text (a long title) and pushes the cards off the right
              edge; make it a plain block so titles truncate instead. */}
          <ScrollArea className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]]:overscroll-contain [&>[data-slot=scroll-area-viewport]>div]:block!">
            {/* Keyed by the active filters so every switch remounts the rows and
                they fade/slide in again. */}
            {/* overflow-x-clip: cards slide in from beyond the right edge and must
                not make the list scroll sideways while they do. */}
            <div key={filter} className="overflow-x-clip pb-3">
              {shown.length > 0 ? (
                dayGroups.map((dayGroup, groupIndex) => {
                  // The entrance stagger runs on across the day groups.
                  const offset = dayGroups
                    .slice(0, groupIndex)
                    .reduce((sum, g) => sum + g.items.length, 0);
                  return (
                    <Fragment key={dayGroup.key}>
                      <DayLabel index={offset + groupIndex + 1} enter={enter}>
                        {t(dayGroup.key)}
                      </DayLabel>
                      <div role="list" aria-label={t(dayGroup.key)} className="space-y-2 ps-3 pe-4 pb-1">
                        {dayGroup.items.map((notification, i) => (
                          <NotificationItem
                            key={notification.id}
                            notification={notification}
                            onMarkAsRead={markAsRead}
                            onNavigate={onClose}
                            index={offset + groupIndex + 2 + i}
                            enter={enter}
                            highlight={arrivedIds.includes(notification.id)}
                          />
                        ))}
                      </div>
                    </Fragment>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center text-muted-foreground animate-in fade-in-0 duration-200 motion-reduce:animate-none">
                  <EmptyIcon className="mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">{emptyText}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      ) : null}
    </div>
  );
}
