"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NonNegotiableReport } from "@/types/dashboard-report.types";
import { fmtDateTime, fmtDuration, WbrCardSkeleton } from "./wbr-format";
import { WbrDetailDialog } from "./wbr-detail-dialog";

function groupByAction(
  reports: NonNegotiableReport[],
): { action: string; items: NonNegotiableReport[] }[] {
  const map = new Map<string, NonNegotiableReport[]>();
  for (const r of reports) {
    const list = map.get(r.action) ?? [];
    list.push(r);
    map.set(r.action, list);
  }
  return [...map.entries()].map(([action, items]) => ({ action, items }));
}

function timingLine(r: NonNegotiableReport): string {
  const start = fmtDateTime(r.date, r.time);
  if (!r.date_two) return start;
  const end = fmtDateTime(r.date_two, r.time_two);
  const dur = fmtDuration(r.date, r.time, r.date_two, r.time_two);
  return `${start} → ${end}${dur ? ` · ${dur}` : ""}`;
}

export function WbrNonNegotiableCard({
  data,
  isLoading,
  className,
}: {
  data?: NonNegotiableReport[];
  isLoading?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const groups = groupByAction(data);
  const empty = data.length === 0;

  return (
    <>
      <Card
        onClick={() => !empty && setOpen(true)}
        className={cn(
          "flex h-[280px] flex-col gap-0 py-1.5 transition-shadow bg-linear-to-r from-red-50 via-red-100 to-red-200 dark:from-red-950/20 dark:via-red-900/40 dark:to-red-800/50",
          !empty && "cursor-pointer hover:shadow-md",
          className,
        )}
      >
        <CardHeader className="shrink-0 px-3 pb-1.5">
          <CardTitle className="flex items-center gap-1.5 text-[11px] font-semibold">
            <div
              className={cn(
                "rounded p-0.5",
                empty
                  ? "bg-emerald-500/15 dark:bg-emerald-500/20"
                  : "bg-red-500/15 dark:bg-red-500/20",
              )}
            >
              {empty ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <ShieldAlert className="h-3 w-3 text-red-500" />
              )}
            </div>
            Weekly Non-Negotiable Reports
            <Badge
              variant="secondary"
              className={cn(
                "ml-auto h-4 px-1.5 py-0 text-[10px]",
                data.length > 0
                  ? "bg-red-500/15 text-red-600 dark:text-red-400"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              )}
            >
              {data.length}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 py-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <p className="text-[11px] text-muted-foreground">
                No incidents this period.
              </p>
            </div>
          ) : (
            <div>
              {groups.map((g, gi) => (
                <div key={g.action}>
                  {gi > 0 && (
                    <hr className="my-2 border-red-200/70 dark:border-red-800/50" />
                  )}
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="h-4 border-red-300 px-1.5 py-0 text-[10px] font-semibold text-red-600 dark:text-red-400"
                    >
                      {g.action}
                    </Badge>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {g.items.length}×
                    </span>
                  </div>
                  <div className="space-y-1 pl-1">
                    {g.items.map((r) => (
                      <div
                        key={r.id}
                        className="rounded bg-background/40 px-2 py-1"
                      >
                        <p className="text-[11px] font-medium tabular-nums leading-snug">
                          {timingLine(r)}
                        </p>
                        {r.notes?.trim() && (
                          <p className="line-clamp-1 text-[10px] text-muted-foreground">
                            {r.notes.trim()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Non-Negotiable Reports"
        badgeText={`${data.length} incident${data.length === 1 ? "" : "s"}`}
      >
        <div className="space-y-6">
          {groups.map((g, gi) => (
            <div key={g.action}>
              {gi > 0 && <hr className="mb-4 border-border" />}
              <div className="mb-3 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-red-300 text-[11px] text-red-600 dark:text-red-400"
                >
                  {g.action}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {g.items.length} incident{g.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-3">
                {g.items.map((r) => {
                  const dur = fmtDuration(
                    r.date,
                    r.time,
                    r.date_two,
                    r.time_two,
                  );
                  return (
                    <div
                      key={r.id}
                      className="rounded-lg border bg-background/40 p-3 text-[12px]"
                    >
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
                        <span className="text-muted-foreground">Started</span>
                        <span>{fmtDateTime(r.date, r.time)}</span>
                        {r.date_two && (
                          <>
                            <span className="text-muted-foreground">Ended</span>
                            <span>{fmtDateTime(r.date_two, r.time_two)}</span>
                          </>
                        )}
                        {dur && (
                          <>
                            <span className="text-muted-foreground">
                              Duration
                            </span>
                            <span>{dur}</span>
                          </>
                        )}
                      </div>
                      {r.notes?.trim() && (
                        <p className="mt-2 whitespace-pre-wrap break-words border-t pt-2 text-muted-foreground">
                          {r.notes.trim()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </WbrDetailDialog>
    </>
  );
}
