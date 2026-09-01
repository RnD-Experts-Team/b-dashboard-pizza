"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ImageOff, Maximize2, Trash2 } from "lucide-react";
import type { PublishedSchedule } from "@/types/scheduling.types";
import { formatIsoDate, formatTimestamp } from "@/lib/scheduling/week";

/**
 * History of published weeks.
 *
 * The thumbnail opens a full-size viewer. It is the whole point of the card —
 * a week grid squeezed into an `aspect-video` box is unreadable, so leaving it
 * as a static image meant the history could be browsed but not actually read.
 *
 * Two things changed when this was wired up:
 *
 *   `screenshotUrl` is a URL to a stored file, not a base64 data URL, and it is
 *   optional — publishing without a screenshot is allowed.
 *
 *   There is no Restore action. The backend has the machinery for
 *   unpublish/restore (its batch-type enum lists both) but exposes no HTTP route
 *   for either, so an enabled button here would be a dead end.
 */

interface PublishedSchedulesProps {
  schedules: PublishedSchedule[];
  onDelete: (id: string) => void;
  /**
   * Hides the Delete action. Set from the Compare view, which is read-only —
   * the history is still worth browsing there, but deleting a published week
   * is a real change and does not belong behind a comparison.
   */
  readOnly?: boolean;
}

export function PublishedSchedules({
  schedules,
  onDelete,
  readOnly = false,
}: PublishedSchedulesProps) {
  /**
   * `previewOpen` is deliberately separate from `preview`.
   *
   * Binding the dialog to `open={!!preview}` and nulling the data on close
   * empties the content on the same frame the close begins, so the title and
   * image blank out while the dialog is still fading. Keeping the last
   * selection lets it stay rendered until it is gone.
   */
  const [preview, setPreview] = useState<PublishedSchedule | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (schedules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No published schedules yet. Publish a week to post it for staff.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {schedules.map((schedule) => {
        const superseded = Boolean(schedule.unpublishedAt);
        return (
          <Card key={schedule.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="truncate text-sm font-medium">
                  {schedule.weekLabel}
                </CardTitle>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {formatTimestamp(schedule.publishedAt, "MMM d, yyyy")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                {schedule.screenshotUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPreview(schedule);
                      setPreviewOpen(true);
                    }}
                    aria-label={`View the schedule posted for ${schedule.weekLabel}`}
                    className="group absolute inset-0 cursor-zoom-in"
                  >
                    <Image
                      src={schedule.screenshotUrl}
                      alt={`Schedule for ${schedule.weekLabel}`}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Maximize2 className="h-5 w-5 text-white" />
                    </span>
                  </button>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                    <ImageOff className="h-5 w-5" />
                    <span className="text-[11px]">No screenshot</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
                <span>
                  {schedule.shiftCount} shift{schedule.shiftCount !== 1 ? "s" : ""}
                </span>
                <span>·</span>
                <span>{schedule.totalHours.toFixed(1)}h</span>
                <span>·</span>
                <span>week of {formatIsoDate(schedule.weekStartDate, "MMM d")}</span>
                {superseded && (
                  <Badge
                    variant="outline"
                    className="ms-auto text-[9px] text-muted-foreground"
                  >
                    Superseded
                  </Badge>
                )}
              </div>

              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => onDelete(schedule.id)}
                >
                  <Trash2 className="me-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/*
        Full-size viewer. Same single-scroller shape as the availability dialog:
        a bounded flex column whose middle pane scrolls, so a tall week grid can
        be read without the header and actions sliding away.
      */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{preview?.weekLabel}</DialogTitle>
            <DialogDescription>
              {preview
                ? `Posted ${formatTimestamp(preview.publishedAt, "MMM d, yyyy 'at' h:mm a")}`
                : null}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted">
            {preview?.screenshotUrl && (
              <Image
                src={preview.screenshotUrl}
                alt={`Schedule for ${preview.weekLabel}`}
                width={1600}
                height={900}
                className="h-auto w-full"
                unoptimized
              />
            )}
          </div>

          <DialogFooter className="mt-3 gap-2 border-t pt-3 sm:justify-between">
            {preview?.screenshotUrl && (
              <a
                href={preview.screenshotUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open the original image
              </a>
            )}
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
