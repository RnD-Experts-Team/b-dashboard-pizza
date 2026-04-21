"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useNotificationStore } from "@/lib/store/notification.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useRealtimeNotifications } from "@/lib/realtime/use-realtime-notifications";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const fetchUnreadNotifications = useNotificationStore((state) => state.fetchUnreadNotifications);

  // Auth state — needed for the Reverb WebSocket connection
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  // ── Fetch unread count on mount ────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    fetchUnreadNotifications(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchUnreadNotifications]);

  // ── Start the WebSocket connection for real-time notifications ─────────
  useRealtimeNotifications({ token, userId });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
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
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0" sideOffset={8}>
        <NotificationPanel onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

