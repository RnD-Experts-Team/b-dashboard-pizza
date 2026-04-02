"use client";

import { useAnnouncementStore } from "@/lib/store/announcement.store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { X, AlertTriangle, Star, Info, ExternalLink, Pizza } from "lucide-react";

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

export function AnnouncementPopup() {
  const { activePopupAnnouncement, setActivePopup, markAsSeen } =
    useAnnouncementStore();

  const ann = activePopupAnnouncement;
  if (!ann) return null;

  const config = priorityConfig[ann.priority];
  const PriorityIcon = config.icon;

  function handleClose() {
    markAsSeen(ann!.id);
    setActivePopup(null);
  }

  return (
    <Dialog open={!!ann} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-lg sm:max-w-xl md:max-w-2xl p-0 gap-0 overflow-hidden"
      >
        {/* Hidden accessible title */}
        <DialogTitle className="sr-only">{ann.title}</DialogTitle>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 end-3 z-10 rounded-full h-8 w-8 flex items-center justify-center bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-muted transition-colors"
          aria-label="Close announcement"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Media */}
        {ann.media && (
          <div className="relative w-full aspect-video bg-muted">
            {ann.media.type === "video" ? (
              <iframe
                src={ann.media.url}
                title={ann.media.alt ?? ann.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Pizza className="h-20 w-20 text-muted-foreground/30" />
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-3">
          {/* Priority badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn("gap-1 text-xs font-medium", config.className)}
            >
              <PriorityIcon className="h-3 w-3" />
              {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              from {ann.author.name} · {ann.author.role}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold leading-snug">
            {ann.title}
          </h2>

          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {ann.content}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Dismiss
            </Button>
            <Button size="sm" onClick={handleClose} className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              View All Announcements
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
