"use client";

import { useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useNotificationStore } from "@/lib/store/notification.store";
import { useNotificationUiStore } from "@/lib/store/notification-ui.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useRealtimeNotifications } from "@/lib/realtime/use-realtime-notifications";
import { NotificationDrawer } from "@/components/notifications/notification-drawer";
import { NotificationToastStack } from "@/components/notifications/notification-toast-stack";
import { useTopbarBox } from "@/components/notifications/use-topbar-box";
import { cn } from "@/lib/utils";

function BellIconButton({
  unreadCount,
  className,
  ...props
}: { unreadCount: number } & React.ComponentProps<typeof Button>) {
  const t = useTranslations("notifications");
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("title")}
      className={cn("relative", className)}
      {...props}
    >
      <Bell className="h-[1.2rem] w-[1.2rem]" />
      {unreadCount > 0 && (
        <span
          className={cn(
            "absolute -top-1 -end-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none",
            unreadCount > 9 ? "h-5 w-5" : "h-4 w-4"
          )}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Button>
  );
}

/**
 * The topbar bell. It owns the whole notification UI, so nothing else has to
 * be mounted in the shell:
 * - the drawer it opens (slides in from the inline-end side under the topbar);
 * - the persistent toast stack (the screen's top inline-end corner);
 * - the initial fetch and the realtime connection that feeds both.
 * Both are portaled to <body>. The drawer is positioned from the topbar's
 * measured box, so it fits every shell layout; the stack only needs its
 * direction.
 */
export function NotificationBell() {
  const bellRef = useRef<HTMLButtonElement>(null);
  const box = useTopbarBox(bellRef);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const drawerOpen = useNotificationUiStore((state) => state.drawerOpen);
  const toggleDrawer = useNotificationUiStore((state) => state.toggleDrawer);

  // Auth state — needed for the Reverb WebSocket connection
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  // ── Fetch notifications on mount — single source of truth shared by the
  // badge count, the drawer list, and the sidebar unread-dot indicator. ──
  useEffect(() => {
    const ctrl = new AbortController();
    fetchNotifications(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchNotifications]);

  // ── Start the WebSocket connection for real-time notifications ─────────
  useRealtimeNotifications({ token, userId });

  return (
    <>
      {/* data-guide-id: PageGuide spotlight target. */}
      <div data-guide-id="topbar-notifications">
        <BellIconButton
          ref={bellRef}
          unreadCount={unreadCount}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={toggleDrawer}
        />
      </div>
      <NotificationDrawer box={box} returnFocusRef={bellRef} />
      <NotificationToastStack box={box} />
    </>
  );
}
