"use client";

import { useEffect, useMemo, useState } from "react";
import { useNotificationStore } from "@/lib/store/notification.store";
import { NotificationItem } from "@/components/notifications/notification-item";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCheck, Bell, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NOTIFICATION_GROUPS,
  countByGroup,
  getNotificationGroupKey,
  type NotificationGroupKey,
} from "@/lib/notifications/notification-groups";

type StatusTab = "all" | "unread";
type GroupFilter = "all" | NotificationGroupKey;

interface NotificationPanelProps {
  onClose?: () => void;
  /** Rendered full-height inside the mobile bottom Sheet instead of the
   * small anchored desktop/tablet popover — fills the sheet and lets
   * notification text wrap instead of being clamped. */
  mobile?: boolean;
}

const TAB_TRIGGER_CLASS =
  "rounded-none border-0 bg-transparent px-4 py-2 text-xs text-muted-foreground shadow-none " +
  "data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none " +
  "dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent";

function UnreadDot() {
  return (
    <span
      aria-hidden
      className="size-1.5 shrink-0 rounded-full bg-destructive animate-in fade-in-0 zoom-in-50 duration-200 motion-reduce:animate-none"
    />
  );
}

export function NotificationPanel({ onClose, mobile = false }: NotificationPanelProps) {
  const { notifications, unreadCount, isLoading, error, markAsRead, markAllAsRead, fetchNotifications } =
    useNotificationStore();
  const [status, setStatus] = useState<StatusTab>("all");
  const [selectedGroup, setSelectedGroup] = useState<GroupFilter>("all");

  useEffect(() => {
    const ctrl = new AbortController();
    fetchNotifications(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchNotifications]);

  const groupCounts = useMemo(() => countByGroup(notifications), [notifications]);
  const visibleGroups = NOTIFICATION_GROUPS.filter((g) => groupCounts.has(g.key));

  // The chosen group can vanish (e.g. its notifications get deleted upstream) —
  // fall back to "all" rather than showing an empty list with no chip selected.
  const group: GroupFilter =
    selectedGroup === "all" || groupCounts.has(selectedGroup) ? selectedGroup : "all";

  const inGroup = useMemo(
    () =>
      group === "all"
        ? notifications
        : notifications.filter((n) => getNotificationGroupKey(n) === group),
    [notifications, group]
  );
  const scopedUnread = useMemo(() => inGroup.filter((n) => n.read_at === null), [inGroup]);
  const shown = status === "unread" ? scopedUnread : inGroup;

  const groupLabel = NOTIFICATION_GROUPS.find((g) => g.key === group)?.label;
  const emptyText =
    status === "unread"
      ? groupLabel
        ? `No unread ${groupLabel} notifications`
        : "All caught up!"
      : groupLabel
      ? `No ${groupLabel} notifications`
      : "No notifications";
  const EmptyIcon = status === "unread" ? CheckCheck : Bell;

  return (
    <div className={mobile ? "flex h-full flex-col" : "w-80 sm:w-90"}>
      {/* Header — the Sheet supplies its own close button on mobile (top-end
          corner), and the popover dismisses on outside click on desktop/tablet,
          so this row only ever needs the title + mark-all-read action. */}
      <div className={cn("flex items-center justify-between gap-2 px-4 py-3", mobile && "pe-10")}>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto shrink-0 px-2 py-1 text-xs text-muted-foreground"
            onClick={markAllAsRead}
          >
            <CheckCheck className="me-1 h-3.5 w-3.5" />
            Mark all as read
          </Button>
        )}
      </div>

      <Separator />

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
            Retry
          </Button>
        </div>
      )}

      {!isLoading || notifications.length > 0 ? (
        <div className={mobile ? "flex min-h-0 flex-1 flex-col" : "w-full"}>
          {/* Status tabs — the underline slides between the two halves. Positioned
              with a logical inset so it also slides the right way in RTL. */}
          <Tabs value={status} onValueChange={(v) => setStatus(v as StatusTab)} className="gap-0">
            <TabsList className="relative grid h-auto w-full grid-cols-2 rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="all" className={TAB_TRIGGER_CLASS}>
                All ({inGroup.length})
              </TabsTrigger>
              <TabsTrigger value="unread" className={TAB_TRIGGER_CLASS}>
                Unread ({scopedUnread.length})
              </TabsTrigger>
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-0 h-0.5 w-1/2 bg-primary transition-[inset-inline-start] duration-300 ease-out motion-reduce:transition-none"
                style={{ insetInlineStart: status === "unread" ? "50%" : "0%" }}
              />
            </TabsList>
          </Tabs>

          {/* Type filter chips — only for groups that actually have notifications.
              The red dot reads off ALL statuses so it stays put while the user
              flips between All and Unread. */}
          {notifications.length > 0 && (
            <div
              role="group"
              aria-label="Filter by type"
              className="flex shrink-0 gap-1.5 no-scrollbar overflow-x-auto border-b px-3 py-2"
            >
              {[{ key: "all" as const, label: "All", icon: null }, ...visibleGroups].map((g) => {
                const active = group === g.key;
                const hasUnread =
                  g.key === "all" ? unreadCount > 0 : (groupCounts.get(g.key)?.unread ?? 0) > 0;
                const Icon = g.icon;
                return (
                  <button
                    key={g.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedGroup(g.key)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium outline-none transition-colors",
                      "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {Icon && <Icon className="size-3.5" />}
                    {g.label}
                    {hasUnread && <UnreadDot />}
                    {hasUnread && <span className="sr-only">(has unread)</span>}
                  </button>
                );
              })}
            </div>
          )}

          <ScrollArea className={mobile ? "min-h-0 flex-1" : "h-88"}>
            {/* Keyed by the active filters so every switch remounts the rows and
                they fade/slide in again. */}
            <div key={`${status}:${group}`}>
              {shown.length > 0 ? (
                <div className="divide-y">
                  {shown.map((notification, index) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markAsRead}
                      onNavigate={onClose}
                      compact={!mobile}
                      index={index}
                    />
                  ))}
                </div>
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
