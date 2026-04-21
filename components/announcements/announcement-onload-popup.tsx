"use client";

import { useEffect, useState, useCallback } from "react";
import { announcementService } from "@/lib/api/services/announcement.service";
import type { Announcement, AnnouncementType } from "@/types/announcement.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, Wrench, Eye, Loader2, Calendar, Pin } from "lucide-react";
import { format } from "date-fns";

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

/**
 * On mount, fetches visible announcements and shows the newest one
 * in a mandatory popup. The only way to close is "Mark as Seen".
 */
export function AnnouncementOnLoadPopup() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isMarking, setIsMarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    announcementService
      .getVisibleAnnouncements(controller.signal)
      .then((list) => {
        if (cancelled || list.length === 0) return;
        const sorted = [...list].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setAnnouncement(sorted[0]);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const handleMarkSeen = useCallback(async () => {
    if (!announcement) return;
    setIsMarking(true);
    try {
      await announcementService.markAnnouncementsSeen([announcement.id]);
      setAnnouncement(null);
    } catch {
      setAnnouncement(null);
    } finally {
      setIsMarking(false);
    }
  }, [announcement]);

  if (!announcement) return null;

  const config = typeConfig[announcement.type] ?? typeConfig.general;
  const TypeIcon = config.icon;

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl p-0 gap-0 mt-5"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{announcement.title}</DialogTitle>
        <DialogDescription className="sr-only">
          New announcement — mark as seen to continue
        </DialogDescription>

        <div className="relative">
          {/* Floating type pill — centered on top edge, half outside */}
          <div className="absolute top-0 inset-x-0 -translate-y-1/2 flex justify-center z-10">
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

          <div className="px-5 pt-10 pb-5 sm:px-6 sm:pb-6 space-y-3">
            {/* Meta row: pinned + created date */}
            <div className="flex items-center gap-2 flex-wrap">
              {announcement.is_pinned && (
                <Badge variant="outline" className="gap-1 text-[11px] font-medium">
                  <Pin className="h-3 w-3" />
                  Pinned
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {format(new Date(announcement.created_at), "MMMM d, yyyy")}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-lg sm:text-xl font-bold leading-tight tracking-tight">
              {announcement.title}
            </h2>

            {/* Body */}
            <div
              className="text-sm text-muted-foreground leading-relaxed max-h-[50vh] overflow-y-auto announcement-body"
              dangerouslySetInnerHTML={{ __html: announcement.body }}
            />

            {/* Divider */}
            <div className="border-t" />

            {/* Footer: date range + Mark as Seen */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {format(new Date(announcement.starts_at), "MMMM d, yyyy")}
                  {" – "}
                  {format(new Date(announcement.ends_at), "MMMM d, yyyy")}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-1.5 rounded-full text-xs font-medium",
                  config.pillText,
                  config.pillBorder,
                )}
                disabled={isMarking}
                onClick={handleMarkSeen}
              >
                {isMarking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {isMarking ? "Marking…" : "Mark as Seen"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
