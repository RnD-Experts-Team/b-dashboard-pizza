"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Announcement, AnnouncementType } from "@/types/announcement.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, Wrench, Pin, Eye, Calendar, CheckCheck, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

function getRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

const typeConfig: Record<
  AnnouncementType,
  {
    label: string;
    pillBg: string;
    pillText: string;
    pillBorder: string;
    icon: typeof Info;
  }
> = {
  general: {
    label: "General",
    pillBg: "bg-blue-100 dark:bg-blue-500/15",
    pillText: "text-blue-700 dark:text-blue-400",
    pillBorder: "border-blue-300 dark:border-blue-500/40",
    icon: Info,
  },
  maintenance: {
    label: "Maintenance",
    pillBg: "bg-yellow-100 dark:bg-yellow-500/15",
    pillText: "text-yellow-700 dark:text-yellow-400",
    pillBorder: "border-yellow-300 dark:border-yellow-500/40",
    icon: Wrench,
  },
  urgent: {
    label: "Urgent",
    pillBg: "bg-red-100 dark:bg-red-500/15",
    pillText: "text-red-700 dark:text-red-400",
    pillBorder: "border-red-300 dark:border-red-500/40",
    icon: AlertTriangle,
  },
};

interface AnnouncementCardProps {
  announcement: Announcement;
  isUserView?: boolean;
  isSeen?: boolean;
  onMarkSeen?: (id: number) => void;
  isMarkingSeen?: boolean;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  isDeleting?: boolean;
  onView?: () => void;
}

export function AnnouncementCard({
  announcement,
  isUserView = false,
  isSeen = false,
  onMarkSeen,
  isMarkingSeen = false,
  onEdit,
  onDelete,
  isDeleting = false,
  onView,
}: AnnouncementCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = typeConfig[announcement.type] ?? typeConfig.general;
  const TypeIcon = config.icon;

  return (
    <div
      className={cn(
        "relative pt-4",
        isSeen && "opacity-50",
        isUserView && onView && "cursor-pointer group",
      )}
      onClick={isUserView && onView ? onView : undefined}
      role={isUserView && onView ? "button" : undefined}
      tabIndex={isUserView && onView ? 0 : undefined}
      onKeyDown={
        isUserView && onView
          ? (e) => e.key === "Enter" && onView()
          : undefined
      }
    >
      {/* Floating type pill — centered on top edge */}
      <div className="absolute top-0 inset-x-0 flex justify-center z-10">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider shadow-sm",
            "bg-background",
            config.pillBg,
            config.pillText,
            config.pillBorder,
          )}
        >
          <TypeIcon className="h-3.5 w-3.5" />
          {config.label}
        </span>
      </div>

      {/* Card body */}
      <div className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden",
        isUserView && onView && "transition-colors group-hover:border-border/80 group-hover:bg-card/80",
      )}>
        <div className="px-5 pt-8 pb-5 sm:px-6 sm:pt-9 sm:pb-6 space-y-3">
          {/* Meta row: badges + relative time */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {announcement.is_pinned && (
                <Badge variant="outline" className="gap-1 text-[11px] font-medium">
                  <Pin className="h-3 w-3" />
                  Pinned
                </Badge>
              )}
              {isSeen && (
                <Badge
                  variant="outline"
                  className="gap-1 text-[11px] font-medium text-muted-foreground"
                >
                  <CheckCheck className="h-3 w-3" />
                  Read
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {getRelativeTime(announcement.created_at)}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-lg sm:text-xl font-bold leading-tight tracking-tight">
            {announcement.title}
          </h2>

          {/* Body */}
          <div
            className={cn(
              "text-sm text-muted-foreground leading-relaxed announcement-body",
              !isExpanded && "line-clamp-3",
            )}
            dangerouslySetInnerHTML={{ __html: announcement.body }}
          />

          {/* Admin: Read more / Show less toggle */}
          {!isUserView && (
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded((v) => !v);
              }}
            >
              {isExpanded ? (
                <><ChevronUp className="h-3.5 w-3.5" />Show less</>
              ) : (
                <><ChevronDown className="h-3.5 w-3.5" />Read more</>
              )}
            </button>
          )}

          {/* Divider */}
          <div className="border-t" />

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                {format(new Date(announcement.starts_at), "MMMM d, yyyy")}
                {" – "}
                {format(new Date(announcement.ends_at), "MMMM d, yyyy")}
              </span>
            </div>

            {isUserView && onMarkSeen && (
              <Button
                variant={isSeen ? "ghost" : "outline"}
                size="sm"
                className={cn(
                  "gap-1.5 rounded-full text-xs font-medium",
                  !isSeen && config.pillText,
                  !isSeen && config.pillBorder,
                )}
                disabled={isMarkingSeen || isSeen}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isSeen) onMarkSeen(announcement.id);
                }}
              >
                {isSeen ? (
                  <>
                    <CheckCheck className="h-3.5 w-3.5" />
                    Read
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    Mark as Read
                  </>
                )}
              </Button>
            )}

            {!isUserView && (
              <div className="flex items-center gap-2">
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "gap-1.5 rounded-full text-xs font-medium",
                      config.pillText,
                      config.pillBorder,
                    )}
                    onClick={() => onEdit(announcement.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-full text-xs font-medium text-destructive border-destructive/40 hover:bg-destructive/10"
                    disabled={isDeleting}
                    onClick={() => onDelete(announcement.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
