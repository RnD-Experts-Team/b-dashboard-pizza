"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { useIssueBasketStore } from "@/lib/store/issue-basket.store";
import { usePayBasketStore } from "@/lib/store/pay-basket.store";
import { StatusChip } from "./ticket-chips";
import type { IssueStatus, Ticket, TicketsFilters } from "@/types/maintenance-tickets.types";

/**
 * The other tickets, alongside the one you are working.
 *
 * It used to read the list page's store, which is not persisted -- so opening a
 * ticket from a pasted link showed nothing at all, and when it did show it was
 * whatever page-N slice the list happened to be holding. It fetches its own now,
 * with its own search and its own status filter, and it sticks while the page
 * scrolls so you never lose it.
 *
 * Each row is tickable. A basket holds ISSUES and the rail knows TICKETS, so
 * ticking one puts all of that ticket's issues in -- which is what "work this
 * ticket too" means. The ids come free: the list endpoint already eager-loads
 * them upstream.
 */

/** Big enough that the coordinator sees everything without paging, small enough
 *  not to be reckless. If a store ever exceeds this the search is the answer. */
const RAIL_PAGE_SIZE = 200;

const QUICK_STATUSES: Array<{ value: IssueStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "Working" },
  { value: "waiting", label: "Waiting" },
];

interface TicketRailProps {
  locale: string;
  activeId: number;
  /** The store to scope to. Undefined fetches across stores. */
  storeId?: string;
  className?: string;
}

export function TicketRail({ locale, activeId, storeId, className }: TicketRailProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<IssueStatus | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (filters: TicketsFilters) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setIsLoading(true);
      try {
        const res = storeId
          ? await maintenanceTicketsService.getTickets(storeId, filters, ctrl.signal)
          : await maintenanceTicketsService.getGlobalTickets(filters, ctrl.signal);
        setTickets(res.data);
        setError(null);
      } catch (err) {
        if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
        setError("Could not load the other tickets.");
      } finally {
        setIsLoading(false);
      }
    },
    [storeId]
  );

  // Debounced, because this is a second list request and every request here
  // makes the auth server verify the token.
  useEffect(() => {
    const timer = setTimeout(() => {
      void load({
        per_page: RAIL_PAGE_SIZE,
        ...(search.trim() ? { q: search.trim() } : {}),
        ...(status ? { issue_statuses: [status] } : {}),
      });
    }, 300);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [load, search, status]);

  return (
    <aside
      className={cn(
        // Sticky against the app shell's scroller, not the window -- globals.css
        // puts overflow:hidden on html/body and AppShell owns the real scroll.
        "hidden w-64 shrink-0 lg:block",
        "sticky top-0 self-start",
        className
      )}
    >
      <div className="flex max-h-[calc(100dvh-8rem)] flex-col rounded-xl border bg-card">
        <div className="space-y-2 border-b p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Other tickets
            </p>
            {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Store, number, or problem"
              aria-label="Search the other tickets"
              className="h-8 ps-7 pe-7 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear"
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* The filters worth having here. The full set lives on the list -- a
              rail with ten controls would be the old navigator all over again. */}
          <div className="flex flex-wrap gap-1">
            {QUICK_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(status === s.value ? null : s.value)}
                aria-pressed={status === s.value}
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                  status === s.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {error && <p className="p-2 text-[11px] text-destructive">{error}</p>}

          {!error && tickets.length === 0 && !isLoading && (
            <p className="p-2 text-[11px] text-muted-foreground">
              {search || status ? "Nothing matches that." : "No other tickets."}
            </p>
          )}

          <div className="space-y-1">
            {tickets.map((ticket) => (
              <RailRow
                key={ticket.id}
                ticket={ticket}
                locale={locale}
                isActive={ticket.id === activeId}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function RailRow({
  ticket,
  locale,
  isActive,
}: {
  ticket: Ticket;
  locale: string;
  isActive: boolean;
}) {
  const issueItems = useIssueBasketStore((s) => s.items);
  const toggleIssue = useIssueBasketStore((s) => s.toggle);
  const payItems = usePayBasketStore((s) => s.items);
  const togglePay = usePayBasketStore((s) => s.toggle);

  const issueIds = useMemo(() => ticket.issues.map((i) => i.id), [ticket.issues]);

  /** Ticked when EVERY issue on the ticket is in — a half-in ticket reads as
   *  out, so ticking it completes it rather than emptying it. */
  const allInWork = issueIds.length > 0 && issueIds.every((id) => issueItems.some((i) => i.issueId === id));
  const allInPay = issueIds.length > 0 && issueIds.every((id) => payItems.some((i) => i.issueId === id));

  const where = ticket.otherStore ?? ticket.storeId ?? "—";

  function toggleWholeTicket() {
    for (const issue of ticket.issues) {
      const already = issueItems.some((i) => i.issueId === issue.id);
      if (allInWork === already) {
        toggleIssue({
          issueId: issue.id,
          ticketId: ticket.id,
          storeId: ticket.storeId ?? "",
          title: issue.title,
          storeLabel: where,
        });
      }
    }
  }

  function toggleWholeTicketForPay() {
    for (const issue of ticket.issues) {
      const already = payItems.some((i) => i.issueId === issue.id);
      if (allInPay === already) {
        togglePay({
          issueId: issue.id,
          ticketId: ticket.id,
          storeId: ticket.storeId ?? null,
          otherStore: ticket.otherStore,
          title: issue.title,
          technicianId: null,
          technicianName: null,
        });
      }
    }
  }

  return (
    <div
      className={cn(
        "rounded-md border px-2 py-1.5 transition-colors",
        isActive ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent"
      )}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={allInWork}
          disabled={issueIds.length === 0}
          onCheckedChange={toggleWholeTicket}
          aria-label={
            allInWork ? `Take ticket ${ticket.id} out of the basket` : `Pick up ticket ${ticket.id}`
          }
          className="mt-0.5"
        />

        <Link
          href={`/${locale}/dashboard/maintenance-tickets/${ticket.id}`}
          className="min-w-0 flex-1"
        >
          <span className="flex items-center gap-1.5">
            <span className="text-[11px] tabular-nums text-muted-foreground">#{ticket.id}</span>
            <StatusChip value={ticket.status.value} label={ticket.status.label} />
          </span>
          {/* The information that makes a row recognisable. Remembering the id
              is the thing people cannot do. */}
          <span className="mt-0.5 block truncate text-xs font-medium">{where}</span>
          {ticket.issues.length > 0 && (
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
              {ticket.issues[0].title}
              {ticket.issues.length > 1 && ` +${ticket.issues.length - 1} more`}
            </span>
          )}
        </Link>
      </div>

      <button
        type="button"
        onClick={toggleWholeTicketForPay}
        disabled={issueIds.length === 0}
        aria-pressed={allInPay}
        className={cn(
          "mt-1 w-full rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
          allInPay
            ? "bg-[var(--color-chart-4)]/15 text-[var(--color-chart-4)]"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
          issueIds.length === 0 && "cursor-not-allowed opacity-50"
        )}
      >
        {allInPay ? "Marked for payment" : "Pay for this"}
      </button>
    </div>
  );
}
