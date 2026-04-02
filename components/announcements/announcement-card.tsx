"use client";

import { cn } from "@/lib/utils";
import type { Announcement } from "@/types/announcement.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Star, Info, Pizza } from "lucide-react";

function getRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const priorityConfig = {
  urgent: {
    label: "Urgent",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: AlertTriangle,
  },
  important: {
    label: "Important",
    className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    icon: Star,
  },
  normal: {
    label: "Announcement",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    icon: Info,
  },
};

interface AnnouncementCardProps {
  announcement: Announcement;
  onMarkSeen?: (id: string) => void;
}

export function AnnouncementCard({ announcement, onMarkSeen }: AnnouncementCardProps) {
  const config = priorityConfig[announcement.priority];
  const PriorityIcon = config.icon;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all",
        !announcement.seen && "ring-1 ring-primary/20"
      )}
    >
      {/* Media */}
      {announcement.media && (
        <div className="relative w-full aspect-video bg-muted overflow-hidden">
          {announcement.media.type === "video" ? (
            <iframe
              src={announcement.media.url}
              title={announcement.media.alt ?? announcement.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Pizza className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
        </div>
      )}

      <CardContent className="p-4 sm:p-5 space-y-3">
        {/* Priority badge + unseen dot */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge
            variant="outline"
            className={cn("gap-1 text-xs font-medium", config.className)}
          >
            <PriorityIcon className="h-3 w-3" />
            {config.label}
          </Badge>
          {!announcement.seen && (
            <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              New
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className={cn("text-base sm:text-lg font-semibold leading-snug", !announcement.seen && "text-foreground")}>
          {announcement.title}
        </h2>

        {/* Content */}
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {announcement.content}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
              {announcement.author.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-xs">
              <span className="font-medium">{announcement.author.name}</span>
              <span className="text-muted-foreground"> · {announcement.author.role}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {getRelativeTime(announcement.createdAt)}
            </span>
            {!announcement.seen && onMarkSeen && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onMarkSeen(announcement.id)}
              >
                Mark as seen
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
