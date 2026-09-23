"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useNotificationStore } from "@/lib/store/notification.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useRealtimeNotifications } from "@/lib/realtime/use-realtime-notifications";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { cn } from "@/lib/utils";

function BellIconButton({
  unreadCount,
  className,
  ...props
}: { unreadCount: number } & React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Notifications"
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

export function NotificationBell() {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);

  // Auth state — needed for the Reverb WebSocket connection
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  // ── Fetch notifications on mount — single source of truth shared by the
  // badge count, the popover list, and the sidebar unread-dot indicator. ──
  useEffect(() => {
    const ctrl = new AbortController();
    fetchNotifications(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchNotifications]);

  // ── Start the WebSocket connection for real-time notifications ─────────
  useRealtimeNotifications({ token, userId });

  return (
    <>
      {/* Tablet/desktop — small anchored popover, same convention as app-shell's
          desktop sidebar vs mobile Sheet split. */}
      {/* data-guide-id: PageGuide spotlight target. Both mounts carry it — the
          guide picks whichever one is actually rendered at this breakpoint. */}
      <div data-guide-id="topbar-notifications" className="hidden sm:block">
        <Popover open={desktopOpen} onOpenChange={setDesktopOpen}>
          <PopoverTrigger asChild>
            <BellIconButton unreadCount={unreadCount} />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-auto overflow-hidden p-0"
            sideOffset={8}
            collisionPadding={16}
          >
            <NotificationPanel onClose={() => setDesktopOpen(false)} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Mobile — full-width bottom sheet, so there's room for the full
          notification text and a reliably-visible close button. */}
      <div data-guide-id="topbar-notifications" className="sm:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <BellIconButton unreadCount={unreadCount} />
          </SheetTrigger>
          <SheetContent side="bottom" className="flex h-[85dvh] flex-col gap-0 p-0">
            <SheetTitle className="sr-only">Notifications</SheetTitle>
            <NotificationPanel mobile onClose={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
