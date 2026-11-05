"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDay, weekLabel } from "@/components/business-reports/report-format";
import { cn } from "@/lib/utils";
import type { ReportWeek } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  StoreWeekGrid — stores × weeks inside a card: the first column sticks
 *  while many weeks scroll sideways, and rows are paged so a page never
 *  renders more than PAGE_SIZE stores. Cells are rendered by the caller.
 * ────────────────────────────────────────────────────────────────────────── */

export const GRID_PAGE_SIZE = 25;

/** Class for a data cell — callers add tint / click styles. */
export const GRID_TD = "h-7 min-w-16 border-b border-border/40 px-1.5 text-center tabular-nums";

const STICKY_HEAD =
  "sticky start-0 z-[2] min-w-40 max-w-56 border-b border-e border-border/40 bg-card px-2 text-start";

export function StoreWeekGrid({
  stores,
  weeks,
  firstColLabel,
  renderRowHead,
  renderCell,
  tail,
  note,
}: {
  /** Already ordered; only the current page is rendered. */
  stores: string[];
  weeks: ReportWeek[];
  firstColLabel: string;
  renderRowHead: (store: string) => ReactNode;
  /** Must return a <td>. */
  renderCell: (store: string, week: ReportWeek) => ReactNode;
  /** Optional last column (e.g. the range total). */
  tail?: { header: string; render: (store: string) => ReactNode };
  /** Small text in the footer, after the row count. */
  note?: ReactNode;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(stores.length / GRID_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = stores.slice((current - 1) * GRID_PAGE_SIZE, current * GRID_PAGE_SIZE);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border/50">
        <table className="w-max min-w-full border-separate border-spacing-0 text-[11px]">
          <thead>
            <tr>
              <th
                className={cn(
                  STICKY_HEAD,
                  "top-0 z-[3] py-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground",
                )}
              >
                {firstColLabel}
              </th>
              {weeks.map((w) => (
                <th
                  key={w.week_start}
                  className="sticky top-0 z-[1] border-b border-border/40 bg-card px-1.5 py-1 text-center font-semibold"
                  title={`${weekLabel(w, true)} · ${w.start} → ${w.end}`}
                >
                  <span className="block text-[10px] font-bold tracking-wide">{weekLabel(w)}</span>
                  <span className="block text-[9.5px] font-medium tabular-nums text-muted-foreground">{fmtDay(w.start)}</span>
                </th>
              ))}
              {tail && (
                <th className="sticky top-0 z-[1] border-b border-s border-border/40 bg-card px-2 py-1 text-end text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {tail.header}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((store) => (
              <tr key={store}>
                <th scope="row" className={cn(STICKY_HEAD, "py-0.5 font-normal")}>
                  {renderRowHead(store)}
                </th>
                {weeks.map((w) => renderCell(store, w))}
                {tail && (
                  <td className="border-b border-s border-border/40 px-2 text-end font-semibold tabular-nums">{tail.render(store)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-1 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground">
          {stores.length > GRID_PAGE_SIZE
            ? `Stores ${(current - 1) * GRID_PAGE_SIZE + 1}–${Math.min(current * GRID_PAGE_SIZE, stores.length)} of ${stores.length}`
            : `${stores.length} store${stores.length === 1 ? "" : "s"}`}
          {` · ${weeks.length} week${weeks.length === 1 ? "" : "s"}`}
          {note ? <> · {note}</> : null}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <span className="me-1 text-[10px] text-muted-foreground">
              Page {current} of {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setPage(current - 1)} disabled={current <= 1}>
              <span className="sr-only">Previous page</span>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setPage(current + 1)} disabled={current >= totalPages}>
              <span className="sr-only">Next page</span>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
