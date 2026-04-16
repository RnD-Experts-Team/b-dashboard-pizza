"use client";

import { useRouter, useParams } from "next/navigation";
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
} from "lucide-react";

/**
 * Derive icon & color from the API notification type string.
 * Common types: "announcement.created", "announcement.updated", etc.
 */
function getTypeVisuals(type: string) {
  if (type.startsWith("announcement")) {
    return { Icon: Megaphone, bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400" };
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

/**
 * Extract the first path segment from action_url (ignores trailing ID segments).
 * "/announcements/8" → "announcements"
 * "/announcements"   → "announcements"
 * null / ""          → null
 */
function getPageSegment(actionUrl: string | null | undefined): string | null {
  if (!actionUrl) return null;
  const segment = actionUrl.split("/").filter(Boolean)[0];
  return segment ?? null;
}

/** Capitalize the page segment for display. "announcements" → "Announcements" */
function formatPageLabel(segment: string): string {
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: number) => void;
  onNavigate?: () => void;
}

export function NotificationItem({ notification, onMarkAsRead, onNavigate }: NotificationItemProps) {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const { Icon, bg } = getTypeVisuals(notification.type);
  const isUnread = notification.read_at === null;
  const pageSegment = getPageSegment(notification.action_url);

  function handleClick() {
    if (!pageSegment) return;
    if (isUnread) onMarkAsRead(notification.id);
    onNavigate?.();
    router.push(`/${locale}/dashboard/${pageSegment}`);
  }

  return (
    <div
      role={pageSegment ? "button" : "listitem"}
      tabIndex={pageSegment ? 0 : undefined}
      className={cn(
        "flex items-start gap-3 p-3 rounded-md transition-colors group",
        pageSegment
          ? "cursor-pointer hover:bg-muted/80"
          : "cursor-default",
        isUnread && "bg-muted/50"
      )}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (pageSegment && (e.key === "Enter" || e.key === " ")) handleClick();
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
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {stripHtml(notification.body)}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <p className="text-xs text-muted-foreground/70">
            {getRelativeTime(notification.created_at)}
          </p>
          {pageSegment && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground/70">
                <ExternalLink className="h-2.5 w-2.5" />
                {formatPageLabel(pageSegment)}
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
