"use client";

import { useCallback, useState } from "react";
import { useAnnouncementStore } from "@/lib/store/announcement.store";
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
import { X, AlertTriangle, Info, Wrench, Eye, Calendar, Pin } from "lucide-react";
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

export function AnnouncementPopup() {
  const { activePopupAnnouncement, setActivePopup, markSeen } = useAnnouncementStore();
  const [isMarking, setIsMarking] = useState(false);

  const handleDismiss = useCallback(() => {
    setActivePopup(null);
  }, [setActivePopup]);

  const handleMarkSeen = useCallback(async () => {
    if (!activePopupAnnouncement) return;
    setIsMarking(true);
    await markSeen([activePopupAnnouncement.id]);
    setIsMarking(false);
    setActivePopup(null);
  }, [activePopupAnnouncement, markSeen, setActivePopup]);

  if (!activePopupAnnouncement) return null;

  const current: Announcement = activePopupAnnouncement;
  const config = typeConfig[current.type] ?? typeConfig.general;
  const TypeIcon = config.icon;

  return (
    <Dialog open onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-lg sm:max-w-xl md:max-w-2xl p-0 gap-0 mt-5"
      >
        <DialogTitle className="sr-only">{current.title}</DialogTitle>
        <DialogDescription className="sr-only">
          Announcement popup
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

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 end-3 z-10 rounded-full h-8 w-8 flex items-center justify-center bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-muted transition-colors"
            aria-label="Dismiss announcement"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-5 pt-10 pb-5 sm:px-6 sm:pb-6 space-y-3">
            {/* Meta row: pinned + created date */}
            <div className="flex items-center gap-2 flex-wrap">
              {current.is_pinned && (
                <Badge variant="outline" className="gap-1 text-[11px] font-medium">
                  <Pin className="h-3 w-3" />
                  Pinned
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {format(new Date(current.created_at), "MMMM d, yyyy")}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-lg sm:text-xl font-bold leading-tight tracking-tight">
              {current.title}
            </h2>

            {/* Body */}
            <div
              className="text-sm text-muted-foreground leading-relaxed announcement-body"
              dangerouslySetInnerHTML={{ __html: current.body }}
            />

            {/* Divider */}
            <div className="border-t" />

            {/* Footer: date range + actions */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {format(new Date(current.starts_at), "MMMM d, yyyy")}
                  {" – "}
                  {format(new Date(current.ends_at), "MMMM d, yyyy")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleDismiss}>
                  Dismiss
                </Button>
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
                  <Eye className="h-3.5 w-3.5" />
                  {isMarking ? "Marking…" : "Mark as Seen"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}