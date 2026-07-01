"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckSquare, Square, User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { Ticket, TicketIssue } from "@/types/maintenance-tickets.types";

interface TicketIssuePickerDialogProps {
  open: boolean;
  storeId: string;
  /** Only issues assigned to this technician are shown. */
  technicianId: number;
  technicianName: string;
  selectedIssueIds: number[];
  onClose: () => void;
  onConfirm: (issueIds: number[]) => void;
}

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

/**
 * An issue counts as "assigned to" a technician when that technician is either
 * directly attached to the issue or part of one of its assignments.
 */
function isAssignedToTechnician(issue: TicketIssue, technicianId: number): boolean {
  if (issue.technicians?.some((t) => t.id === technicianId)) return true;
  if (issue.assignments?.some((a) => a.technicians?.some((t) => t.id === technicianId))) return true;
  return false;
}

export function TicketIssuePickerDialog({
  open,
  storeId,
  technicianId,
  technicianName,
  selectedIssueIds,
  onClose,
  onConfirm,
}: TicketIssuePickerDialogProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [issues, setIssues] = useState<TicketIssue[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  const [localSelected, setLocalSelected] = useState<Set<number>>(
    new Set(selectedIssueIds)
  );

  // Fetch tickets when the dialog opens. The technician_id filter narrows the
  // list to tickets that have at least one issue assigned to this technician.
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
      .getTickets(storeId, { per_page: 1000, technician_ids: [technicianId] }, ctrl.signal)
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

  // Fetch issues when a ticket is selected.
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
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    onConfirm(Array.from(localSelected));
  }

  // Only issues assigned to the chosen technician are selectable.
  const visibleIssues = issues.filter((issue) => isAssignedToTechnician(issue, technicianId));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] w-[95vw] overflow-hidden sm:max-w-4xl flex flex-col">
        <DialogHeader>
          <DialogTitle>Browse Tickets &amp; Issues</DialogTitle>
          <DialogDescription>
            Showing only tickets and issues assigned to{" "}
            <span className="font-medium text-foreground">{technicianName || "this technician"}</span>.
            Click a ticket to view its issues, then check the ones to link.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid sm:grid-cols-[1fr_1.5fr] gap-3 min-h-0">
          {/* ── Left: Tickets list ──────────────────────────────────────── */}
          <div className="flex flex-col overflow-hidden rounded-md border">
            <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
              Tickets
            </div>

            {isLoadingTickets && (
              <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                Loading…
              </div>
            )}

            {ticketsError && (
              <div className="flex-1 px-3 py-4 text-center text-xs text-destructive">
                {ticketsError}
              </div>
            )}

            {!isLoadingTickets && !ticketsError && tickets.length === 0 && (
              <div className="flex-1 px-3 py-4 text-center text-xs text-muted-foreground">
                No tickets found.
              </div>
            )}

            {!isLoadingTickets && !ticketsError && tickets.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-muted-foreground">
                      <th className="px-3 py-1.5 text-start font-medium">#</th>
                      <th className="px-3 py-1.5 text-start font-medium">Store</th>
                      <th className="px-3 py-1.5 text-start font-medium">Created</th>
                      <th className="px-3 py-1.5 text-end font-medium">Issues</th>
                    </tr>
                  </thead>
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
                        <td className="px-3 py-2 font-mono">{ticket.id}</td>
                        <td className="px-3 py-2">{ticket.storeId ?? ticket.otherStore ?? "Other"}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatDate(ticket.createdAt)}
                        </td>
                        <td className="px-3 py-2 text-end">{ticket.issueCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Right: Issues list ──────────────────────────────────────── */}
          <div className="flex flex-col overflow-hidden rounded-md border">
            <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
              {selectedTicket
                ? `Issues — Ticket #${selectedTicket.id}`
                : "Issues"}
            </div>

            {!selectedTicket && (
              <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground px-4 py-8 text-center">
                Select a ticket on the left to see its issues.
              </div>
            )}

            {selectedTicket && isLoadingIssues && (
              <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                Loading…
              </div>
            )}

            {selectedTicket && issuesError && (
              <div className="flex-1 px-3 py-4 text-center text-xs text-destructive">
                {issuesError}
              </div>
            )}

            {selectedTicket && !isLoadingIssues && !issuesError && visibleIssues.length === 0 && (
              <div className="flex-1 px-3 py-4 text-center text-xs text-muted-foreground">
                No issues on this ticket are assigned to {technicianName || "this technician"}.
              </div>
            )}

            {selectedTicket && !isLoadingIssues && !issuesError && visibleIssues.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-muted-foreground">
                      <th className="w-8 px-3 py-1.5" />
                      <th className="px-3 py-1.5 text-start font-medium">#</th>
                      <th className="px-3 py-1.5 text-start font-medium">Title</th>
                      <th className="px-3 py-1.5 text-start font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleIssues.map((issue) => {
                      const checked = localSelected.has(issue.id);
                      const title =
                        issue.issueTitle ?? issue.otherTitle ?? "Untitled";
                      return (
                        <tr
                          key={issue.id}
                          className={cn(
                            "cursor-pointer border-b transition-colors last:border-0",
                            checked ? "bg-primary/10" : "hover:bg-muted/50"
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
                          <td className="px-3 py-2 font-mono align-top">{issue.id}</td>
                          <td className="px-3 py-2 max-w-[180px]">
                            <span className="block truncate">{title}</span>
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <User className="h-3 w-3" />
                              Assigned to {technicianName || "technician"}
                            </span>
                          </td>
                          <td className="px-3 py-2 align-top">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
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

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Confirm{localSelected.size > 0 ? ` (${localSelected.size} selected)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
