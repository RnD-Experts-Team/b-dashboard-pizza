"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, MessageSquare, Paperclip, Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LocalTimestamp } from "@/components/maintenance-tickets/local-timestamp";
import { IssueHistoryPanel } from "@/components/maintenance-tickets/issue-history-panel";
import { PriorityBadge, StatusBadge } from "@/components/maintenance-tickets/ticket-chips";
import type {
  AnalyticsActivityTicket,
  AnalyticsCreatedTicket,
  AnalyticsRecurring,
  AnalyticsSummary,
  AnalyticsTroubleshootingFix,
  AnalyticsUntouchedTicket,
} from "@/types/maintenance-analytics.types";

const WHEN = "MMM d · h:mm a";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Pieces shared by every table                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function ticketHref(locale: string, ticketId: number, store: string | null): string {
  return `/${locale}/dashboard/maintenance-tickets/${ticketId}${store ? `?store=${encodeURIComponent(store)}` : ""}`;
}

function TicketLink({ locale, id, store }: { locale: string; id: number; store: string | null }) {
  return (
    <Link
      href={ticketHref(locale, id, store)}
      className="rounded-sm font-semibold tabular-nums text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      #{id}
    </Link>
  );
}

/** The shared ticket badges (status-accent.ts): the same colour and word as on the list and the ticket page. */
export function StatusPill({ value, label }: { value: string; label: string }) {
  return <StatusBadge status={value} label={label} size="sm" />;
}

function PriorityPill({ value, label }: { value: string; label: string }) {
  return <PriorityBadge priority={value} label={label} size="sm" />;
}

/** "2 hours ago", from an ISO instant. */
function ago(iso: string): string {
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? "" : formatDistanceToNowStrict(d, { addSuffix: true });
}

/** "29 hours" under two days, "3 days" after. */
function silence(iso: string): string {
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = Math.max(0, Math.floor((Date.now() - d.getTime()) / 3_600_000));
  return h < 48 ? `${h} hours` : `${Math.floor(h / 24)} days`;
}

/** A titled report table: the title, how many rows, one line on what it holds. */
export function ReportTable({
  id,
  title,
  count,
  unit = "tickets",
  description,
  children,
}: {
  id?: string;
  title: string;
  count?: number;
  unit?: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={titleId} className="scroll-mt-24 overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="border-b px-5 py-4">
        <h2 id={titleId} className="flex flex-wrap items-baseline gap-x-3 font-heading text-lg font-semibold">
          {title}
          {count !== undefined && (
            <span className="font-sans text-sm font-normal text-muted-foreground">
              {count.toLocaleString()} {count === 1 ? unit.replace(/s$/, "") : unit}
            </span>
          )}
        </h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

export const TH = "whitespace-nowrap px-5 py-3 text-start text-sm font-medium text-muted-foreground";
export const TD = "px-5 py-3.5 align-middle";

/** One fixed-height line inside a cell, so stacked values line up across columns. */
function Line({ children }: { children: ReactNode }) {
  return <div className="flex h-8 items-center">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Rows per table page: enough to read, never a page-long scroll. */
export const PAGE_SIZE = 5;

/** One page of `items` at a time. `total` may run ahead of what is loaded. */
export function usePaged<T>(items: T[], total: number = items.length, size: number = PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pages - 1);
  const start = current * size;
  return {
    page: current,
    pages,
    setPage,
    rows: items.slice(start, start + size),
    from: total === 0 ? 0 : start + 1,
    to: Math.min(total, start + size),
    total,
  };
}

export function Pager({
  page,
  pages,
  from,
  to,
  total,
  onPage,
  loading = false,
}: {
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  onPage: (page: number) => void;
  loading?: boolean;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page === 0 || loading} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </Button>
        <span className="tabular-nums">
          Page {page + 1} of {pages}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages - 1 || loading} aria-label="Next page">
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function SectionError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-center gap-2 px-5 py-6 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Tickets opened                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export function NewTickets({
  locale,
  title,
  tickets,
  recurringDays,
  error,
}: {
  locale: string;
  title: string;
  tickets: AnalyticsCreatedTicket[];
  recurringDays: number;
  error?: string;
}) {
  const tr = useTranslations("maintenanceSystem.tickets.analyticsTables");
  const pager = usePaged(tickets);
  return (
    <ReportTable id="new-tickets" title={title} count={error ? undefined : tickets.length}>
      {error ? (
        <SectionError message={error} />
      ) : tickets.length === 0 ? (
        <Empty>{tr("noneOpened")}</Empty>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th scope="col" className={TH}>Ticket</th>
              <th scope="col" className={TH}>Store</th>
              <th scope="col" className={TH}>Issue</th>
              <th scope="col" className={TH}>Priority</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={TH}>Opened by</th>
              <th scope="col" className={TH}>Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pager.rows.map((t) => (
              <tr key={t.ticket_id} className="align-top transition-colors hover:bg-muted/30">
                <td className={cn(TD, "align-top")}><Line><TicketLink locale={locale} id={t.ticket_id} store={t.store_number} /></Line></td>
                <td className={cn(TD, "align-top whitespace-nowrap")}><Line>{t.store_number ?? "-"}</Line></td>
                {/* A ticket can carry several issues: they stack inside its one
                    row, each line the same height in every column, so an
                    issue's priority and status sit level with its name. */}
                <td className={cn(TD, "align-top")}>
                  {t.issues.map((i) => (
                    <Line key={i.id}>
                      <span className="font-medium">{i.title}</span>
                      {i.recurring_count !== null && (
                        <span
                          className="ms-2 inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300"
                          title={`${i.title} came up on ${i.recurring_count} tickets at this store in ${recurringDays} days`}
                        >
                          <Repeat className="h-3 w-3" aria-hidden="true" />
                          {tr("recurringBadge", { count: i.recurring_count, days: recurringDays })}
                        </span>
                      )}
                    </Line>
                  ))}
                </td>
                <td className={cn(TD, "align-top")}>
                  {t.issues.map((i) => <Line key={i.id}><PriorityPill value={i.priority.value} label={i.priority.label} /></Line>)}
                </td>
                <td className={cn(TD, "align-top")}>
                  {t.issues.map((i) => <Line key={i.id}><StatusPill value={i.status.value} label={i.status.label} /></Line>)}
                </td>
                <td className={cn(TD, "align-top whitespace-nowrap")}><Line>{t.creator?.name ?? "-"}</Line></td>
                <td className={cn(TD, "align-top whitespace-nowrap text-muted-foreground")}>
                  <Line><span title={new Date(t.created_at).toLocaleString()}>{ago(t.created_at)}</span></Line>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager {...pager} onPage={pager.setPage} />
    </ReportTable>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Open tickets with no update                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export function Untouched({
  locale,
  tickets,
  days,
  error,
}: {
  locale: string;
  tickets: AnalyticsUntouchedTicket[];
  days: number;
  error?: string;
}) {
  const span = days === 1 ? "24+ Hours" : `${days}+ Days`;
  const tr = useTranslations("maintenanceSystem.tickets.analyticsTables");
  const pager = usePaged(tickets);
  return (
    <ReportTable
      id="untouched"
      title={`Open Tickets With No Update for ${span}`}
      count={error ? undefined : tickets.length}
      description={tr("untouchedDescription")}
    >
      {error ? (
        <SectionError message={error} />
      ) : tickets.length === 0 ? (
        <Empty>{tr("untouchedNone")}</Empty>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th scope="col" className={TH}>Ticket</th>
              <th scope="col" className={TH}>Store</th>
              <th scope="col" className={TH}>Issue</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={TH}>Last update</th>
              <th scope="col" className={TH}>Time since update</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pager.rows.map((t) => {
              const never = Date.parse(t.last_change_at) - Date.parse(t.created_at) < 60_000;
              return (
                <tr key={t.ticket_id} className="transition-colors hover:bg-muted/30">
                  <td className={TD}><TicketLink locale={locale} id={t.ticket_id} store={t.store_number} /></td>
                  <td className={cn(TD, "whitespace-nowrap")}>{t.store_number ?? "-"}</td>
                  <td className={cn(TD, "font-medium")}>{t.open_issues.map((i) => i.title).join(", ")}</td>
                  <td className={TD}><StatusPill value={t.status.value} label={t.status.label} /></td>
                  <td className={cn(TD, "text-muted-foreground")}>
                    {never ? "No update since it was opened" : <LocalTimestamp iso={t.last_change_at} pattern={WHEN} showZone={false} />}
                  </td>
                  <td className={cn(TD, "whitespace-nowrap font-semibold tabular-nums", t.days_silent >= 2 ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
                    {silence(t.last_change_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <Pager {...pager} onPage={pager.setPage} />
    </ReportTable>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  What changed                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export function WhatChanged({
  locale,
  tickets,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
  error,
}: {
  locale: string;
  tickets: AnalyticsActivityTicket[];
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  error?: string;
}) {
  const tr = useTranslations("maintenanceSystem.tickets.analyticsTables");
  const pager = usePaged(tickets, total);
  const goTo = (page: number) => {
    if ((page + 1) * PAGE_SIZE > tickets.length && hasMore) onLoadMore();
    pager.setPage(page);
  };
  return (
    <ReportTable
      id="what-changed"
      title="Tickets Updated in This Range"
      count={error ? undefined : total}
      description={tr("changedDescription")}
    >
      {error ? (
        <SectionError message={error} />
      ) : tickets.length === 0 ? (
        <Empty>{tr("changedNone")}</Empty>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th scope="col" className={TH}>Ticket</th>
                <th scope="col" className={TH}>Store</th>
                <th scope="col" className={TH}>Issue</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={TH}>What changed</th>
                <th scope="col" className={TH}>Last change</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pager.rows.map((t) => {
                const { opened, status_changes: moves, notes, files } = t.changes;
                return (
                  <tr key={t.ticket_id} className="transition-colors hover:bg-muted/30">
                    <td className={TD}><TicketLink locale={locale} id={t.ticket_id} store={t.store_number} /></td>
                    <td className={cn(TD, "whitespace-nowrap")}>{t.store_number ?? "-"}</td>
                    <td className={cn(TD, "font-medium")}>{t.title ?? "-"}</td>
                    <td className={TD}>{t.status && <StatusPill value={t.status.value} label={t.status.label} />}</td>
                    <td className={cn(TD, "min-w-[20rem] py-3")}>
                      <ul className="space-y-1">
                        {opened && <li>Opened</li>}
                        {moves.map((m, i) => (
                          <li key={i}>
                            {m.title ?? "Issue"}: <span className="text-muted-foreground">{m.from ?? "New"} →</span>{" "}
                            <span className="font-medium">{m.to}</span>
                            {m.by && <span className="text-muted-foreground"> · {m.by}</span>}
                          </li>
                        ))}
                        {(notes > 0 || files > 0) && (
                          <li className="flex items-center gap-3 text-muted-foreground">
                            {notes > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                                {notes} {notes === 1 ? "note" : "notes"}
                              </span>
                            )}
                            {files > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                                {files} {files === 1 ? "file" : "files"}
                              </span>
                            )}
                          </li>
                        )}
                        {!opened && moves.length === 0 && notes === 0 && files === 0 && (
                          <li className="text-muted-foreground">{tr("otherWork")}</li>
                        )}
                      </ul>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>
                      <span title={new Date(t.updated_at).toLocaleString()}>{ago(t.updated_at)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pager.rows.length === 0 && isLoadingMore && (
            <p className="flex items-center justify-center gap-2 px-5 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {tr("loading")}
            </p>
          )}
          <Pager {...pager} onPage={goTo} loading={isLoadingMore} />
        </>
      )}
    </ReportTable>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Recurring issues                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

export function Recurring({
  items,
  min,
  days,
  error,
}: {
  items: AnalyticsRecurring[];
  min: number;
  days: number;
  error?: string;
}) {
  const tr = useTranslations("maintenanceSystem.tickets.analyticsTables");
  const [history, setHistory] = useState<AnalyticsRecurring | null>(null);
  const pager = usePaged(items);

  return (
    <ReportTable
      id="recurring"
      title="Recurring Issues"
      count={error ? undefined : items.length}
      unit="issues"
      description={`The same issue on ${min} or more tickets at one store in the last ${days} days.`}
    >
      {error ? (
        <SectionError message={error} />
      ) : items.length === 0 ? (
        <Empty>{tr("recurringNone")}</Empty>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th scope="col" className={TH}>Issue</th>
              <th scope="col" className={TH}>Store</th>
              <th scope="col" className={TH}>Tickets</th>
              <th scope="col" className={TH}>Latest</th>
              <th scope="col" className={cn(TH, "text-end")}><span className="sr-only">History</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pager.rows.map((r) => (
              <tr key={`${r.store_id}:${r.issue_id}`} className="transition-colors hover:bg-muted/30">
                <td className={cn(TD, "font-medium")}>{r.title}</td>
                <td className={cn(TD, "whitespace-nowrap")}>{r.store_number ?? "-"}</td>
                <td className={cn(TD, "font-semibold tabular-nums text-amber-700 dark:text-amber-400")}>
                  {r.count} in {days} days
                </td>
                <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>{r.last_at ? ago(r.last_at) : "-"}</td>
                <td className={cn(TD, "text-end")}>
                  {r.store_number && (
                    <Button variant="outline" size="sm" onClick={() => setHistory(r)}>
                      View tickets
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager {...pager} onPage={pager.setPage} />

      <Sheet open={history !== null} onOpenChange={(open) => !open && setHistory(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {history && history.store_number && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {history.title} at {history.store_number}
                </SheetTitle>
                <SheetDescription>
                  {tr("recurringHistory", { count: history.count, days })}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <IssueHistoryPanel storeNumber={history.store_number} issueId={history.issue_id} issueTitle={history.title} title="Earlier tickets" />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </ReportTable>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  By store                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────── */
/*  Fixed by troubleshooting                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export function TroubleshootingFixes({
  locale,
  fixes,
  rangeLabel,
  error,
}: {
  locale: string;
  fixes: AnalyticsTroubleshootingFix[];
  rangeLabel: string;
  error?: string;
}) {
  const tr = useTranslations("maintenanceSystem.tickets.analyticsTables");
  const pager = usePaged(fixes);
  return (
    <ReportTable
      id="troubleshooting-fixes"
      title={`Fixed by Troubleshooting · ${rangeLabel}`}
      count={error ? undefined : fixes.length}
      unit="problems"
      description={tr("fixesDescription")}
    >
      {error ? (
        <SectionError message={error} />
      ) : fixes.length === 0 ? (
        <Empty>{tr("fixesNone")}</Empty>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th scope="col" className={TH}>When</th>
              <th scope="col" className={TH}>Store</th>
              <th scope="col" className={TH}>Issue</th>
              <th scope="col" className={TH}>The guide that fixed it</th>
              <th scope="col" className={TH}>Logged by</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pager.rows.map((f) => (
              <tr key={f.id} className="transition-colors hover:bg-muted/30">
                <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>
                  <LocalTimestamp iso={f.at} pattern={WHEN} showZone={false} />
                </td>
                <td className={cn(TD, "whitespace-nowrap")}>{f.store_number ?? "-"}</td>
                <td className={cn(TD, "font-medium")}>
                  <Link href={`/${locale}/dashboard/maintenance-troubleshooting/${f.issue_id}`} className="hover:underline">
                    {f.issue_title ?? "-"}
                  </Link>
                </td>
                <td className={TD}>
                  {f.guide_title ? <span>&ldquo;{f.guide_title}&rdquo;</span> : <span className="text-muted-foreground">Not said</span>}
                </td>
                <td className={cn(TD, "text-muted-foreground")}>{f.by?.name ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager {...pager} onPage={pager.setPage} />
    </ReportTable>
  );
}

/** Tighter side padding on a phone: four columns at the full gutter are wider than a 375px card. */
const BY_STORE_TH = "whitespace-nowrap px-3 py-3 text-start text-sm font-medium text-muted-foreground sm:px-5";
const BY_STORE_TD = "px-3 py-3.5 align-middle sm:px-5";

export function ByStore({ rows }: { rows: AnalyticsSummary["by_store"] }) {
  // Busiest first: the stores with the most open work lead.
  const sorted = [...rows].sort((x, y) => y.open - x.open || y.created - x.created);
  const pager = usePaged(sorted);
  return (
    <>
    <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="border-b bg-muted/40">
        <tr>
          <th scope="col" className={BY_STORE_TH}>Store</th>
          <th scope="col" className={cn(BY_STORE_TH, "text-end")}>Opened</th>
          <th scope="col" className={cn(BY_STORE_TH, "text-end")}>Closed</th>
          <th scope="col" className={cn(BY_STORE_TH, "text-end")}>Open now</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {pager.rows.map((r) => (
          <tr key={r.store_number} className="transition-colors hover:bg-muted/30">
            <td className={cn(BY_STORE_TD, "font-medium")}>{r.store_number}</td>
            <td className={cn(BY_STORE_TD, "text-end tabular-nums")}>{r.created}</td>
            <td className={cn(BY_STORE_TD, "text-end tabular-nums")}>{r.completed}</td>
            <td className={cn(BY_STORE_TD, "text-end tabular-nums")}>{r.open}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
    <Pager {...pager} onPage={pager.setPage} />
    </>
  );
}
