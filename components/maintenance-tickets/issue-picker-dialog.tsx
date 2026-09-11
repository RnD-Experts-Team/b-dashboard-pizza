"use client";

import { useEffect, useState } from "react";
import { CheckSquare, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { Ticket, TicketIssue } from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Pick issues across tickets                                               */
/*                                                                            */
/*  This is a near-twin of components/daily-pay/ticket-issue-picker-dialog,   */
/*  and that duplication is deliberate rather than an oversight.              */
/*                                                                            */
/*  The daily-pay dialog hard-filters to issues assigned to the payment's     */
/*  payee, because the backend REQUIRES that for a pay line. Attendance has   */
/*  the opposite requirement: the whole point of the cross-ticket relaxation  */
/*  is "drove to one store, worked three tickets", so filtering by technician */
/*  would defeat it. Generalising the daily-pay component in place would mean */
/*  editing another feature's file to add a flag whose only job is to switch  */
/*  off that feature's core invariant.                                        */
/*                                                                            */
/*  COST, stated honestly: ~250 lines of near-identical fetch/table/selection */
/*  code now live twice. If a THIRD caller appears, lift the shell into       */
/*  components/shared/ and let each feature supply its own predicate.         */
/* ────────────────────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

interface IssuePickerDialogProps {
  open: boolean;
  /** Narrows the ticket list to one store. Null searches unscoped. */
  storeNumber: string | null;
  /** Optional: when set, only issues assigned to this technician are listed. */
  technicianId?: number | null;
  selectedIssueIds: number[];
  /**
   * Issues already covered by the caller. Rendered checked-and-disabled so the
   * user cannot un-pick the thing they are standing on.
   */
  lockedIssueIds?: number[];
  onClose: () => void;
  onConfirm: (issueIds: number[]) => void;
}

function isAssignedToTechnician(issue: TicketIssue, technicianId: number): boolean {
  if (issue.technicians?.some((t) => t.id === technicianId)) return true;
  return (issue.assignments ?? []).some((a) =>
    (a.technicians ?? []).some((t) => t.id === technicianId)
  );
}

export function IssuePickerDialog({
  open,
  storeNumber,
  technicianId,
  selectedIssueIds,
  lockedIssueIds = [],
  onClose,
  onConfirm,
}: IssuePickerDialogProps) {
  const locked = new Set(lockedIssueIds);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [issues, setIssues] = useState<TicketIssue[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  const [localSelected, setLocalSelected] = useState<Set<number>>(
    () => new Set(selectedIssueIds)
  );

  useEffect(() => {
    if (!open) return;

    setSelectedTicket(null);
    setIssues([]);
    setIssuesError(null);
    setLocalSelected(new Set(selectedIssueIds));

    const ctrl = new AbortController();
    setIsLoadingTickets(true);
    setTicketsError(null);

    maintenanceTicketsService
      .getGlobalTickets(
        {
          per_page: 1000,
          ...(storeNumber ? { stores: [storeNumber] } : {}),
          ...(technicianId ? { technician_ids: [technicianId] } : {}),
        },
        ctrl.signal
      )
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setTickets(res.data);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
        setTicketsError(
          err instanceof MaintenanceTicketsError ? err.message : "Failed to load tickets."
        );
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setIsLoadingTickets(false);
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!selectedTicket) return;

    const ctrl = new AbortController();
    setIsLoadingIssues(true);
    setIssuesError(null);
    setIssues([]);

    maintenanceTicketsService
      .getTicketIssues(selectedTicket.storeId ?? "", selectedTicket.id, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setIssues(res.data);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
        setIssuesError(
          err instanceof MaintenanceTicketsError ? err.message : "Failed to load issues."
        );
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setIsLoadingIssues(false);
      });

    return () => ctrl.abort();
  }, [selectedTicket]);

  function toggleIssue(id: number) {
    if (locked.has(id)) return;
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleIssues = technicianId
    ? issues.filter((issue) => isAssignedToTechnician(issue, technicianId))
    : issues;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Browse Tickets &amp; Issues</DialogTitle>
          <DialogDescription>
            Pick issues this visit should also count toward. They may belong to other
            tickets — attendance is the one record type that allows that.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-3 sm:grid-cols-2">
          {/* Tickets */}
          <div className="flex min-h-0 flex-col rounded-md border">
            <p className="border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tickets
            </p>
            {isLoadingTickets && (
              <div className="flex flex-1 items-center justify-center py-8 text-xs text-muted-foreground">
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                Loading…
              </div>
            )}
            {!isLoadingTickets && ticketsError && (
              <p className="flex-1 px-3 py-4 text-center text-xs text-destructive">
                {ticketsError}
              </p>
            )}
            {!isLoadingTickets && !ticketsError && tickets.length === 0 && (
              <p className="flex-1 px-3 py-4 text-center text-xs text-muted-foreground">
                No tickets found.
              </p>
            )}
            {!isLoadingTickets && !ticketsError && tickets.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className={cn(
                          "cursor-pointer border-b transition-colors last:border-0",
                          selectedTicket?.id === ticket.id
                            ? "bg-primary/10"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <td className="px-3 py-2 font-mono">#{ticket.id}</td>
                        <td className="max-w-[160px] px-3 py-2">
                          <span className="block truncate">
                            {ticket.issueTitles?.[0] ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {ticket.storeId ?? ticket.otherStore ?? "Other"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {formatDate(ticket.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Issues */}
          <div className="flex min-h-0 flex-col rounded-md border">
            <p className="border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Issues
            </p>
            {!selectedTicket && (
              <p className="flex-1 px-3 py-4 text-center text-xs text-muted-foreground">
                Pick a ticket on the left.
              </p>
            )}
            {selectedTicket && isLoadingIssues && (
              <div className="flex flex-1 items-center justify-center py-8 text-xs text-muted-foreground">
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                Loading…
              </div>
            )}
            {selectedTicket && !isLoadingIssues && issuesError && (
              <p className="flex-1 px-3 py-4 text-center text-xs text-destructive">
                {issuesError}
              </p>
            )}
            {selectedTicket && !isLoadingIssues && !issuesError && visibleIssues.length === 0 && (
              <p className="flex-1 px-3 py-4 text-center text-xs text-muted-foreground">
                No issues on this ticket.
              </p>
            )}
            {selectedTicket && !isLoadingIssues && !issuesError && visibleIssues.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {visibleIssues.map((issue) => {
                      const isLocked = locked.has(issue.id);
                      const checked = isLocked || localSelected.has(issue.id);
                      const title = issue.issueTitle ?? issue.otherTitle ?? "Untitled";
                      return (
                        <tr
                          key={issue.id}
                          title={isLocked ? "Already covered by this entry" : undefined}
                          className={cn(
                            "border-b transition-colors last:border-0",
                            isLocked
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer",
                            checked ? "bg-primary/10" : !isLocked && "hover:bg-muted/50"
                          )}
                          onClick={() => toggleIssue(issue.id)}
                        >
                          <td className="px-3 py-2 align-top">
                            {checked ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="px-3 py-2 align-top font-mono">{issue.id}</td>
                          <td className="max-w-[180px] px-3 py-2">
                            <span className="block truncate">{title}</span>
                          </td>
                          <td className="px-3 py-2 align-top">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {issue.status.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(Array.from(localSelected))}>
            Use {localSelected.size} issue{localSelected.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
