"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, Loader2, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusChip, PriorityChip } from "@/components/maintenance-tickets/ticket-chips";
import { LocalTimestamp } from "@/components/maintenance-tickets/local-timestamp";
import { IssueHistoryPanel } from "@/components/maintenance-tickets/issue-history-panel";
import type {
  AnalyticsActivityTicket,
  AnalyticsCreatedTicket,
  AnalyticsRecurring,
  AnalyticsSummary,
  AnalyticsUntouchedTicket,
} from "@/types/maintenance-analytics.types";

function ticketHref(locale: string, ticketId: number, store: string | null): string {
  return `/${locale}/dashboard/maintenance-tickets/${ticketId}${store ? `?store=${encodeURIComponent(store)}` : ""}`;
}

export function SectionError({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      {message}
    </p>
  );
}

export function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-muted-foreground">{children}</p>;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  What changed -- the tickets changed in the range, and how                 */
/* ────────────────────────────────────────────────────────────────────────── */

function countLine(notes: number, files: number): string | null {
  const parts = [
    notes > 0 ? `${notes} ${notes === 1 ? "note" : "notes"}` : null,
    files > 0 ? `${files} ${files === 1 ? "file" : "files"}` : null,
  ].filter(Boolean);
  return parts.length ? `${parts.join(" and ")} added` : null;
}

export function WhatChanged({
  locale,
  tickets,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  locale: string;
  tickets: AnalyticsActivityTicket[];
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  if (tickets.length === 0) {
    return <EmptyLine>No ticket changed in this range.</EmptyLine>;
  }

  return (
    <div className="space-y-3">
      {tickets.map((t) => {
        const counts = countLine(t.changes.notes, t.changes.files);
        const nothingShown = !t.changes.opened && t.changes.status_changes.length === 0 && !counts;
        return (
          <div key={t.ticket_id} className="rounded-lg border bg-background p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={ticketHref(locale, t.ticket_id, t.store_number)} className="font-medium text-primary hover:underline">
                Ticket #{t.ticket_id}
              </Link>
              {t.title && <span className="text-sm">{t.title}</span>}
              {t.store_number && <span className="text-xs text-muted-foreground">{t.store_number}</span>}
              {t.status && <StatusChip value={t.status.value} label={t.status.label} />}
              <span className="text-xs text-muted-foreground">
                Last change <LocalTimestamp iso={t.updated_at} pattern="MMM d · h:mm a" showZone={false} />
              </span>
            </div>
            <ol className="mt-2 space-y-1 border-s ps-3">
              {t.changes.opened && <li className="text-sm">Opened</li>}
              {t.changes.status_changes.map((c, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <LocalTimestamp iso={c.at} pattern="MMM d · h:mm a" showZone={false} className="text-xs text-muted-foreground" />
                  <span>
                    {c.title ?? "Issue"}: {c.from ? `${c.from} → ` : ""}
                    {c.to}
                  </span>
                  {c.by && <span className="text-xs text-muted-foreground">— {c.by}</span>}
                </li>
              ))}
              {counts && <li className="text-sm">{counts}</li>}
              {nothingShown && <li className="text-sm text-muted-foreground">Worked on (a visit, booking or part -- no status change or note)</li>}
            </ol>
          </div>
        );
      })}
      {hasMore && (
        <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoadingMore}>
          {isLoadingMore && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
          Show more ({total - tickets.length} more tickets)
        </Button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  New tickets -- what was filed in the range                                */
/* ────────────────────────────────────────────────────────────────────────── */

export function NewTickets({
  locale,
  tickets,
  recurringDays,
}: {
  locale: string;
  tickets: AnalyticsCreatedTicket[];
  recurringDays: number;
}) {
  if (tickets.length === 0) {
    return <EmptyLine>No tickets were opened in this range.</EmptyLine>;
  }

  return (
    <ul className="divide-y rounded-lg border bg-background">
      {tickets.map((t) => (
        <li key={t.ticket_id} className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-72">
            <Link href={ticketHref(locale, t.ticket_id, t.store_number)} className="font-medium text-primary hover:underline">
              Ticket #{t.ticket_id}
            </Link>
            <span className="text-xs text-muted-foreground">{t.store_number}</span>
            <StatusChip value={t.status.value} label={t.status.label} />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {t.issues.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{i.title}</span>
                <PriorityChip value={i.priority.value} label={i.priority.label} prefix="" />
                {i.recurring_count !== null && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                    title={`${i.title} came up on ${i.recurring_count} tickets at this store in ${recurringDays} days`}
                  >
                    <Repeat className="h-3 w-3" aria-hidden="true" />
                    {i.recurring_count} in {recurringDays} days
                  </span>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Opened <LocalTimestamp iso={t.created_at} pattern="MMM d · h:mm a" showZone={false} />
              {t.creator ? ` by ${t.creator.name}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Untouched -- open and silent                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export function Untouched({ locale, tickets, days }: { locale: string; tickets: AnalyticsUntouchedTicket[]; days: number }) {
  if (tickets.length === 0) {
    return <EmptyLine>Every open ticket has been touched in the last {days === 1 ? "day" : `${days} days`}.</EmptyLine>;
  }

  return (
    <ul className="divide-y rounded-lg border bg-background">
      {tickets.map((t) => (
        <li key={t.ticket_id} className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex shrink-0 items-center gap-3 sm:w-48">
            <span
              className={cn(
                "inline-flex min-w-16 justify-center rounded-md px-2 py-1 text-sm font-semibold tabular-nums",
                t.days_silent >= 7
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
              )}
              title="Days since anything happened on this ticket"
            >
              {t.days_silent} {t.days_silent === 1 ? "day" : "days"}
            </span>
            <Link href={ticketHref(locale, t.ticket_id, t.store_number)} className="font-medium text-primary hover:underline">
              #{t.ticket_id}
            </Link>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs text-muted-foreground">{t.store_number}</span>
              {t.open_issues.map((i) => (
                <span key={i.id} className="inline-flex items-center gap-1.5">
                  <span className="font-medium">{i.title}</span>
                  <StatusChip value={i.status.value} label={i.status.label} />
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {Date.parse(t.last_change_at) - Date.parse(t.created_at) < 60_000 ? (
                <>
                  Nothing done since it was opened ·{" "}
                  <LocalTimestamp iso={t.created_at} pattern="MMM d · h:mm a" showZone={false} />
                </>
              ) : (
                <>
                  Last change · <LocalTimestamp iso={t.last_change_at} pattern="MMM d · h:mm a" showZone={false} />
                </>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Recurring -- what keeps coming back, with the history one click away      */
/* ────────────────────────────────────────────────────────────────────────── */

export function Recurring({ items, min, days }: { items: AnalyticsRecurring[]; min: number; days: number }) {
  const [open, setOpen] = useState<string | null>(null);

  if (items.length === 0) {
    return <EmptyLine>No issue came up on {min} or more tickets at one store in the last {days} days.</EmptyLine>;
  }

  return (
    <ul className="divide-y rounded-lg border bg-background">
      {items.map((r) => {
        const key = `${r.store_id}:${r.issue_id}`;
        const isOpen = open === key;

        return (
          <li key={key} className="p-3">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : key)}
              aria-expanded={isOpen}
              className="flex w-full flex-wrap items-center gap-3 text-start"
            >
              <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")} aria-hidden="true" />
              <span className="font-medium">{r.title}</span>
              <span className="text-xs text-muted-foreground">{r.store_number}</span>
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                {r.count} tickets
              </span>
              {r.last_at && (
                <span className="text-xs text-muted-foreground">
                  latest <LocalTimestamp iso={r.last_at} pattern="MMM d" showZone={false} />
                </span>
              )}
              <span className="ms-auto text-xs text-primary">{isOpen ? "Hide tickets" : "See the tickets"}</span>
            </button>
            {isOpen && r.store_number && (
              <div className="mt-3">
                <IssueHistoryPanel
                  storeNumber={r.store_number}
                  issueId={r.issue_id}
                  issueTitle={r.title}
                  title={`${r.title} tickets at ${r.store_number}`}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  By store -- three numbers per store, as a table                            */
/* ────────────────────────────────────────────────────────────────────────── */

export function ByStore({ rows }: { rows: AnalyticsSummary["by_store"] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-start font-medium">Store</th>
            <th scope="col" className="px-3 py-2 text-end font-medium">Opened in range</th>
            <th scope="col" className="px-3 py-2 text-end font-medium">Completed in range</th>
            <th scope="col" className="px-3 py-2 text-end font-medium">Open now</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.store_number}>
              <td className="px-3 py-2 font-medium">{r.store_number}</td>
              <td className="px-3 py-2 text-end tabular-nums">{r.created}</td>
              <td className="px-3 py-2 text-end tabular-nums">{r.completed}</td>
              <td className="px-3 py-2 text-end tabular-nums">{r.open}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
