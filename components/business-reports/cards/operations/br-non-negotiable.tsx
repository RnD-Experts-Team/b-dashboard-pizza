"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime, fmtDuration } from "@/components/dspr/wbr-format";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import type { NonNegotiableRow, OperationsSection } from "@/types/business-reports.types";
import { NO_VALUE, plural } from "./br-shared";

/** Incidents listed under each action in the card body; the dialog has them all. */
const ROWS_PER_GROUP = 3;

interface Incident extends NonNegotiableRow {
  key: string;
  storeLabel: string;
}

function timingLine(r: NonNegotiableRow): string {
  const start = fmtDateTime(r.date, r.time);
  if (!r.date_two) return start;
  const dur = fmtDuration(r.date, r.time, r.date_two, r.time_two);
  return `${start} → ${fmtDateTime(r.date_two, r.time_two)}${dur ? ` · ${dur}` : ""}`;
}

function groupByAction(rows: Incident[]): { action: string; items: Incident[] }[] {
  const groups = new Map<string, Incident[]>();
  rows.forEach((r) => {
    const list = groups.get(r.action);
    if (list) list.push(r);
    else groups.set(r.action, [r]);
  });
  return [...groups.entries()]
    .map(([action, items]) => ({ action, items }))
    .sort((a, b) => b.items.length - a.items.length);
}

const sortKeyOf = (r: NonNegotiableRow) => `${r.date} ${r.time ?? ""}`;

const COLUMNS: PagedColumn<Incident>[] = [
  { key: "started", header: "Started", sortValue: sortKeyOf, render: (r) => fmtDateTime(r.date, r.time), className: "whitespace-nowrap" },
  { key: "action", header: "Action", sortValue: (r) => r.action, render: (r) => r.action },
  { key: "store", header: "Store", sortValue: (r) => r.storeLabel, render: (r) => r.storeLabel },
  {
    key: "ended",
    header: "Ended",
    sortValue: (r) => r.date_two,
    render: (r) => (r.date_two ? fmtDateTime(r.date_two, r.time_two) : NO_VALUE),
    className: "whitespace-nowrap",
  },
  { key: "duration", header: "Duration", render: (r) => fmtDuration(r.date, r.time, r.date_two, r.time_two) ?? NO_VALUE },
  {
    key: "notes",
    header: "Notes",
    render: (r) => <span className="line-clamp-2 min-w-[180px] whitespace-normal">{r.notes?.trim() || NO_VALUE}</span>,
  },
];

/** Non-negotiable incidents across the stores, grouped by action. */
export function BrNonNegotiableCard({ data }: { data: OperationsSection }) {
  const { storeName } = useReport();
  const [open, setOpen] = useState(false);
  const rows = useMemo<Incident[]>(
    () =>
      data.non_negotiables.map((r, i) => ({
        ...r,
        key: `${r.store}-${r.date}-${r.time ?? ""}-${i}`,
        storeLabel: storeName(r.store),
      })),
    [data.non_negotiables, storeName],
  );
  const groups = useMemo(() => groupByAction(rows), [rows]);
  const empty = rows.length === 0;

  return (
    <V1Card
      reportId="br-non-negotiable"
      title="Non-Negotiable Reports"
      category="operations"
      period="R"
      span={2}
      onExpand={empty ? undefined : () => setOpen(true)}
      headerNote={
        <Badge
          variant="secondary"
          className={cn(
            "h-4 px-1.5 py-0 text-[10px] tabular-nums",
            empty
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/15 text-red-600 dark:text-red-400",
          )}
        >
          {rows.length.toLocaleString()}
        </Badge>
      }
    >
      {empty ? (
        <V1Empty icon={CheckCircle2}>
          <span className="text-emerald-600 dark:text-emerald-400">All clear — no incidents in this range.</span>
        </V1Empty>
      ) : (
        <div>
          {groups.map((g, gi) => (
            <div key={g.action}>
              {gi > 0 && <hr className="my-2 border-red-200/70 dark:border-red-800/50" />}
              <div className="mb-1.5 flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="h-4 border-red-300 px-1.5 py-0 text-[10px] font-semibold text-red-600 dark:border-red-800 dark:text-red-400"
                >
                  {g.action}
                </Badge>
                <span className="ms-auto text-[10px] tabular-nums text-muted-foreground">{g.items.length}×</span>
              </div>
              <div className="space-y-1 ps-1">
                {g.items.slice(0, ROWS_PER_GROUP).map((r) => (
                  <div key={r.key} className="rounded bg-background/40 px-2 py-1">
                    <p className="flex items-center justify-between gap-2 text-[11px] font-medium leading-snug">
                      <span className="truncate">{r.storeLabel}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{timingLine(r)}</span>
                    </p>
                    {r.notes?.trim() && <p className="line-clamp-1 text-[10px] text-muted-foreground">{r.notes.trim()}</p>}
                  </div>
                ))}
                {g.items.length > ROWS_PER_GROUP && (
                  <p className="px-2 text-[10px] text-muted-foreground">
                    +{(g.items.length - ROWS_PER_GROUP).toLocaleString()} more — open for all
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && (
        <WbrDetailDialog
          open
          onOpenChange={(o) => !o && setOpen(false)}
          title="Non-Negotiable Reports"
          badgeText={plural(rows.length, "incident")}
        >
          <PagedTable rows={rows} columns={COLUMNS} rowKey={(r) => r.key} initialSort="started" />
        </WbrDetailDialog>
      )}
    </V1Card>
  );
}
