"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageOff, Trash2 } from "lucide-react";
import type { PublishedSchedule } from "@/types/scheduling.types";

/**
 * History of published weeks.
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
}

export function PublishedSchedules({
  schedules,
  onDelete,
}: PublishedSchedulesProps) {
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
                  {new Date(schedule.publishedAt).toLocaleDateString()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                {schedule.screenshotUrl ? (
                  <Image
                    src={schedule.screenshotUrl}
                    alt={`Schedule for ${schedule.weekLabel}`}
                    fill
                    className="object-contain"
                    unoptimized
                  />
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
                {superseded && (
                  <Badge
                    variant="outline"
                    className="ms-auto text-[9px] text-muted-foreground"
                  >
                    Superseded
                  </Badge>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => onDelete(schedule.id)}
              >
                <Trash2 className="me-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
