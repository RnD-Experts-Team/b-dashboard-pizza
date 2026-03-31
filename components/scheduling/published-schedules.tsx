"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Trash2 } from "lucide-react";
import type { PublishedSchedule } from "@/types/scheduling.types";

interface PublishedSchedulesProps {
  schedules: PublishedSchedule[];
  onRestore: (schedule: PublishedSchedule) => void;
  onDelete: (id: string) => void;
}

export function PublishedSchedules({
  schedules,
  onRestore,
  onDelete,
}: PublishedSchedulesProps) {
  if (schedules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          No published schedules yet. Create and publish a schedule above.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {schedules.map((schedule) => (
        <Card key={schedule.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {schedule.weekLabel}
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {new Date(schedule.publishedAt).toLocaleDateString()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
              <Image
                src={schedule.screenshotDataUrl}
                alt={`Schedule for ${schedule.weekLabel}`}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onRestore(schedule)}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Restore
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(schedule.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
