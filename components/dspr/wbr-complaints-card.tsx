"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MessageSquareWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WbrComplaint } from "@/types/hooks.types";
import { fmtDate, WbrCardSkeleton } from "./wbr-format";
import { WbrDetailDialog, DetailField } from "./wbr-detail-dialog";

export function WbrComplaintsCard({
  data,
  isLoading,
  className,
}: {
  data?: WbrComplaint[];
  isLoading?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const empty = data.length === 0;

  return (
    <>
      <Card
        onClick={() => !empty && setOpen(true)}
        className={cn(
          "flex h-[280px] flex-col gap-0 py-1.5 transition-shadow bg-linear-to-r from-orange-50 via-orange-100 to-orange-200 dark:from-orange-950/20 dark:via-orange-900/40 dark:to-orange-800/50",
          !empty && "cursor-pointer hover:shadow-md",
          className,
        )}
      >
        <CardHeader className="shrink-0 px-3 pb-1">
          <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
            <div className="rounded bg-orange-500/15 p-0.5 dark:bg-orange-500/20">
              <MessageSquareWarning className="h-3 w-3 text-orange-500" />
            </div>
            Complaints
            <Badge
              variant="secondary"
              className={cn(
                "ml-auto h-4 px-1.5 py-0 text-[10px]",
                data.length > 0
                  ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {data.length}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-2">
          {empty ? (
            <p className="py-2 text-[11px] text-muted-foreground">
              No complaints this week.
            </p>
          ) : (
            data.map((c) => (
              <div key={c.id} className="rounded-md bg-background/40 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold">
                    {c.first_name} {c.last_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {fmtDate(c.complaint_date)}
                  </span>
                </div>
                <p className="line-clamp-2 text-[11px] text-muted-foreground">
                  {c.issue}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Complaints"
        badgeText={`${data.length} record${data.length === 1 ? "" : "s"}`}
      >
        <div className="space-y-3">
          {data.map((c) => (
            <div
              key={c.id}
              className="space-y-2 rounded-lg border bg-background/40 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {c.first_name} {c.last_name}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {fmtDate(c.complaint_date)}
                </span>
              </div>
              <div className="space-y-1.5">
                <DetailField label="Phone" value={c.phone} />
                <DetailField label="Email" value={c.email} />
                <DetailField
                  label="Mgr Informed"
                  value={c.manager_informed}
                />
                <DetailField label="Issue" value={c.issue} wrap />
                <DetailField label="Suggestion" value={c.suggestion} wrap />
              </div>
            </div>
          ))}
        </div>
      </WbrDetailDialog>
    </>
  );
}
