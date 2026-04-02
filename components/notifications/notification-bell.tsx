"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useNotificationStore } from "@/lib/store/notification.store";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  return (
    <Popover>
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
        <NotificationPanel />
      </PopoverContent>
    </Popover>
  );
}
