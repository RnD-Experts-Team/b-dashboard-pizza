"use client";

import { cn } from "@/lib/utils";
import type { Notification } from "@/types/notification.types";
import { Button } from "@/components/ui/button";
import {
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Megaphone,
  Check,
} from "lucide-react";

const iconMap = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: XCircle,
  announcement: Megaphone,
};

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

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onClick?: (id: string) => void;
}

export function NotificationItem({ notification, onMarkAsRead, onClick }: NotificationItemProps) {
  const Icon = iconMap[notification.type] ?? Info;

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors hover:bg-muted/80 group",
        !notification.read && "bg-muted/50"
      )}
      onClick={() => onClick?.(notification.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.(notification.id);
      }}
    >
      {/* Icon */}
      <div className={cn(
        "mt-0.5 shrink-0 rounded-full p-1.5",
        notification.type === "error" && "bg-destructive/10 text-destructive",
        notification.type === "warning" && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
        notification.type === "success" && "bg-green-500/10 text-green-600 dark:text-green-400",
        notification.type === "info" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        notification.type === "announcement" && "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      )}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm leading-tight",
          !notification.read ? "font-semibold" : "font-normal text-muted-foreground"
        )}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {getRelativeTime(notification.timestamp)}
        </p>
      </div>

      {/* Mark as read button — visible on hover for unread only */}
      {!notification.read && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
