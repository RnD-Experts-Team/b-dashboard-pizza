"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowUpRight,
  Clock,
  Package,
  Stethoscope,
  Store as StoreIcon,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { formatDateOrTimestamp, formatTimestamp } from "@/lib/utils/date-display";
import { StatusChip, PriorityChip } from "./ticket-chips";
import type { Ticket, TicketIssue } from "@/types/maintenance-tickets.types";

/**
 * A quick look at a ticket, from a dashboard.
 *
 * READ-ONLY on purpose. A dashboard card is a showcase -- you glance to see
 * whether something needs you, and if it does you go and work it on the ticket
 * page. Putting the actions here too would mean two full ticket UIs to keep in
 * step, which is what the old 4,424-line sheet became.
 *
 * The list rail is the part worth keeping from that sheet: landing on one
 * ticket and being stuck there is what made people bounce back out to the
 * table. Here you can walk the whole list without closing anything.
 */

interface TicketPreviewSheetProps {
  open: boolean;
  /** The row that was clicked. */
  ticketId: number | null;
  /** The rows already on screen — this sheet fetches no list of its own. */
  tickets: Ticket[];
  onClose: () => void;
}

export function TicketPreviewSheet({
  open,
  ticketId,
  tickets,
  onClose,
}: TicketPreviewSheetProps) {
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";

  const [activeId, setActiveId] = useState<number | null>(ticketId);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [issues, setIssues] = useState<TicketIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) setActiveId(ticketId);
  }, [open, ticketId]);

  const load = useCallback(async (id: number) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsLoading(true);
    setError(null);
    try {
      // The unscoped read, so this works for an "other store" ticket too --
      // those have no store to put in a store-scoped URL.
      const res = await maintenanceTicketsService.getTicketIssuesById(id, ctrl.signal);
      setTicket(res.ticket);
      setIssues(res.data);
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      setError(err instanceof MaintenanceTicketsError ? err.message : "Could not load that ticket.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || activeId == null) return;
    void load(activeId);
    return () => abortRef.current?.abort();
  }, [open, activeId, load]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-[95vw]! p-0 sm:w-[80vw]! lg:w-[62vw]!">
        <SheetTitle className="sr-only">Ticket preview</SheetTitle>
        <SheetDescription className="sr-only">
          A read-only look at the selected ticket, with the other tickets listed alongside.
        </SheetDescription>

        <div className="flex h-full min-h-0">
          {/* The rail. Hidden on small screens, where there is no room for two
              panes and the list is one tap away behind the sheet anyway. */}
          <nav className="hidden w-56 shrink-0 overflow-y-auto border-e bg-muted/20 p-2 md:block">
            <p className="px-1.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tickets.length === 1 ? "1 ticket" : `${tickets.length} tickets`}
            </p>
            <div className="space-y-1">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  className={cn(
                    "w-full rounded-md px-2.5 py-2 text-start text-xs transition-colors",
                    t.id === activeId
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="tabular-nums">#{t.id}</span>
                    <StatusChip value={t.status.value} label={t.status.label} />
                  </span>
                  <span className="mt-0.5 block truncate">
                    {t.otherStore ?? t.storeId ?? "—"}
                  </span>
                  {t.issueTitles.length > 0 && (
                    <span className="mt-0.5 block truncate text-[11px] opacity-80">
                      {t.issueTitles[0]}
                      {t.issueTitles.length > 1 && ` +${t.issueTitles.length - 1}`}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            {isLoading && !ticket && (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
                {error}
              </p>
            )}

            {ticket && (
              <div className={cn("space-y-4", isLoading && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-2 border-b pb-3">
                  <h2 className="font-heading text-lg font-semibold">Ticket #{ticket.id}</h2>
                  <StatusChip value={ticket.status.value} label={ticket.status.label} />
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <StoreIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {ticket.otherStore ?? ticket.storeId ?? "Store not recorded"}
                  </span>
                  <Link
                    href={`/${locale}/dashboard/maintenance-tickets/${ticket.id}`}
                    className="ms-auto inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Open full ticket
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {issues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing reported on this ticket yet.</p>
                ) : (
                  issues.map((issue) => <IssuePreview key={issue.id} issue={issue} />)
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** One issue, told rather than edited. */
function IssuePreview({ issue }: { issue: TicketIssue }) {
  const title = issue.issueTitle ?? issue.otherTitle ?? `Issue #${issue.id}`;
  const liveAttendance = issue.attendanceEntries.filter((a) => !a.mistaken);
  const liveParts = issue.partUsages.filter((p) => !p.mistaken);
  const liveDiagnoses = issue.diagnoses.filter((d) => !d.mistaken);

  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{title}</span>
        <StatusChip value={issue.status.value} label={issue.status.label} />
        <PriorityChip value={issue.priority.value} label={issue.priority.label} />
      </div>

      {issue.description && (
        <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">
          {issue.description}
        </p>
      )}

      {issue.technicians.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3" aria-hidden="true" />
          {issue.technicians.map((t) => t.name).join(", ")}
        </p>
      )}

      {/* What has been recorded, counted rather than listed -- the question a
          dashboard answers is "has anything happened", not "what exactly". */}
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {liveAttendance.length > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {liveAttendance.length === 1 ? "1 visit" : `${liveAttendance.length} visits`}
            {liveAttendance[0]?.startClock && ` · last ${formatTimestamp(liveAttendance[0].startClock)}`}
          </span>
        )}
        {liveParts.length > 0 && (
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" aria-hidden="true" />
            {liveParts.length === 1 ? "1 part" : `${liveParts.length} parts`}
          </span>
        )}
        {liveDiagnoses.length > 0 && (
          <span className="flex items-center gap-1">
            <Stethoscope className="h-3 w-3" aria-hidden="true" />
            {liveDiagnoses.length === 1 ? "1 note" : `${liveDiagnoses.length} notes`}
          </span>
        )}
        <span className="ms-auto">raised {formatDateOrTimestamp(issue.createdAt)}</span>
      </div>
    </section>
  );
}
