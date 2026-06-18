"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { NonNegotiableReport } from "@/types/dashboard-report.types";
import {
  fmtDateTime,
  fmtDuration,
  WbrCardSkeleton,
} from "@/components/dspr/wbr-format";
import {
  WbrDetailDialog,
  DetailField,
} from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1NonNegotiableCard — weekly non-negotiable incident reports.
 *  Data shaping mirrors components/dspr/wbr-non-negotiable-card.tsx.
 * ────────────────────────────────────────────────────────────────────────── */

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

export function V1NonNegotiableCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: NonNegotiableReport[];
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (isLoading)
    return (
      <div className={["col-span-1 md:col-span-1 lg:col-span-2", className].filter(Boolean).join(" ")}>
        <WbrCardSkeleton />
      </div>
    );
  if (!data)
    return (
      <V1Card title="Non-Negotiable Reports" category="operations" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const groups = groupByAction(data);
  const empty = data.length === 0;

  return (
      <V1Card
        title="Non-Negotiable Reports"
        category="operations"
        period="W"
        span={span}
        className={className}
        onExpand={empty ? undefined : () => setOpen(true)}
        headerNote={
          <Badge
            variant="secondary"
            className={cn(
              "h-4 px-1.5 py-0 text-[10px]",
              empty
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/15 text-red-600 dark:text-red-400",
            )}
          >
            {data.length}
          </Badge>
        }
      >
        {empty ? (
          <V1Empty icon={CheckCircle2}>
            <span className="text-emerald-600 dark:text-emerald-400">
              All clear — no incidents this period.
            </span>
          </V1Empty>
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
                      className="space-y-1.5 rounded-lg border bg-background/40 p-3"
                    >
                      <DetailField
                        label="Started"
                        value={fmtDateTime(r.date, r.time)}
                      />
                      {r.date_two && (
                        <DetailField
                          label="Ended"
                          value={fmtDateTime(r.date_two, r.time_two)}
                        />
                      )}
                      {dur && <DetailField label="Duration" value={dur} />}
                      {r.notes?.trim() && (
                        <DetailField label="Notes" value={r.notes.trim()} wrap />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </WbrDetailDialog>
    </V1Card>
  );
}
