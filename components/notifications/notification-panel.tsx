"use client";

import { useNotificationStore } from "@/lib/store/notification.store";
import { NotificationItem } from "@/components/notifications/notification-item";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCheck, Bell } from "lucide-react";

export function NotificationPanel() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotificationStore();
  const unreadNotifications = notifications.filter((n) => !n.read);

  return (
    <div className="w-80 sm:w-90">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 text-xs text-muted-foreground"
            onClick={markAllAsRead}
          >
            <CheckCheck className="h-3.5 w-3.5 me-1" />
            Mark all as read
          </Button>
        )}
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger
            value="all"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-4 py-2 text-xs"
          >
            All ({notifications.length})
          </TabsTrigger>
          <TabsTrigger
            value="unread"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-4 py-2 text-xs"
          >
            Unread ({unreadCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-0">
          <ScrollArea className="h-80">
            {notifications.length > 0 ? (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="unread" className="mt-0">
          <ScrollArea className="h-80">
            {unreadNotifications.length > 0 ? (
              <div className="divide-y">
                {unreadNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCheck className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">All caught up!</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
