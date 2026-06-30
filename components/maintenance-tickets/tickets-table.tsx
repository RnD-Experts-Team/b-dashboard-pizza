"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { format } from "date-fns";
import { Ban, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TicketsListResponse, Ticket, TicketStatus } from "@/types/maintenance-tickets.types";
import { maintenanceTicketsService, MaintenanceTicketsError } from "@/lib/api/services/maintenance-tickets.service";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Status badge                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  pending:     "bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  assigned:    "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400",
  in_progress: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30 dark:text-indigo-400",
  complete:    "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400",
  cancelled:   "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
  deferred:    "bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-400",
};

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("maintenanceTickets.status");
  const key = status as TicketStatus;
  const label = key === "cancelled"
    ? "Cancelled"
    : t(key as keyof ReturnType<typeof useTranslations<"maintenanceTickets.status">>);
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
      STATUS_COLORS[status] ?? "bg-muted text-foreground border-border"
    )}>
      {label}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Table row                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

interface TicketRowProps {
  ticket: Ticket;
  onClick: (ticket: Ticket) => void;
  onChanged: () => void;
  canCancelTicket?: boolean;
}

function TicketRow({ ticket, onClick, onChanged, canCancelTicket = true }: TicketRowProps) {
  const t = useTranslations("maintenanceTickets");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog(e: React.MouseEvent) {
    e.stopPropagation();
    setReason("");
    setError(null);
    setDialogOpen(true);
  }

  async function handleConfirmCancel() {
    if (!reason.trim()) { setError("Reason is required."); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      await maintenanceTicketsService.cancelTicket(ticket.storeId ?? "", ticket.id, { reason: reason.trim() });
      setDialogOpen(false);
      toast.success("Ticket cancelled successfully.");
      onChanged();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Failed to cancel ticket.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRestore(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await maintenanceTicketsService.restoreTicket(ticket.storeId ?? "", ticket.id);
      toast.success("Ticket restored successfully.");
      onChanged();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Failed to restore ticket.");
    }
  }

  return (
    <>
      <TableRow
        className="cursor-pointer transition-colors hover:bg-muted/50"
        onClick={() => onClick(ticket)}
      >
        <TableCell className="font-mono text-sm font-medium">#{ticket.id}</TableCell>
        <TableCell>
          <StatusBadge status={ticket.status.value} />
        </TableCell>
        <TableCell className="max-w-[220px]">
          {ticket.issueTitles.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {ticket.issueTitles.slice(0, 2).map((title, i) => (
                <span
                  key={i}
                  className="inline-block max-w-[160px] truncate rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
                  title={title}
                >
                  {title}
                </span>
              ))}
              {ticket.issueTitles.length > 2 && (
                <span
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  title={ticket.issueTitles.slice(2).join(", ")}
                >
                  +{ticket.issueTitles.length - 2}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              {ticket.issueCount} {t("columns.issuesCount")}
            </span>
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground dark:text-white">{ticket.storeId ?? ticket.otherStore ?? "Other"}</TableCell>
        <TableCell className="text-sm text-muted-foreground dark:text-white">
          {ticket.creator?.name ?? <span className="opacity-40">—</span>}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground dark:text-white whitespace-nowrap">
          {format(new Date(ticket.createdAt), "MMM d, yyyy")}
        </TableCell>
        {canCancelTicket && (
          <TableCell>
            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              {ticket.deletedAt ? (
                <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleRestore}>
                  <RotateCcw className="h-3.5 w-3.5 me-1" />
                  Restore
                </Button>
              ) : ticket.status.value === "cancelled" ? (
                <Button variant="outline" size="sm" className="h-7 px-2" disabled>
                  <Ban className="h-3.5 w-3.5 me-1" />
                  Cancelled
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={openDialog}>
                  <Ban className="h-3.5 w-3.5 me-1" />
                  Cancel
                </Button>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>

      {/* Cancel reason dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!isSubmitting) setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Cancel Ticket #{ticket.id}</DialogTitle>
            <DialogDescription>
              Provide a reason for cancelling this ticket. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason" className="text-sm">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              placeholder="Enter cancellation reason…"
              className="resize-none min-h-24"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(null); }}
              disabled={isSubmitting}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              Confirm Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Pagination controls                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

interface PaginationProps {
  meta: TicketsListResponse["meta"];
  currentPage: number;
  onPageChange: (page: number) => void;
}

function PaginationBar({ meta, currentPage, onPageChange }: PaginationProps) {
  const t = useTranslations("maintenanceTickets.pagination");
  const isFirst = currentPage <= 1;
  const isLast = currentPage >= meta.lastPage;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
      <p className="text-sm text-muted-foreground">
        {t("page", { current: currentPage, total: meta.lastPage })}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={isFirst}
          onClick={() => onPageChange(1)}
          aria-label={t("first")}
        >
          <ChevronFirst className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={isFirst}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label={t("previous")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={isLast}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label={t("next")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={isLast}
          onClick={() => onPageChange(meta.lastPage)}
          aria-label={t("last")}
        >
          <ChevronLast className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main export                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export interface TicketsTableProps {
  data: TicketsListResponse;
  isRefreshing: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  onTicketClick: (ticket: Ticket) => void;
  onRowChanged: () => void;
  canCancelTicket?: boolean;
}

export function TicketsTable({
  data,
  isRefreshing,
  currentPage,
  onPageChange,
  onTicketClick,
  onRowChanged,
  canCancelTicket = true,
}: TicketsTableProps) {
  const t = useTranslations("maintenanceTickets");

  return (
    <div className={cn("space-y-3 transition-opacity", isRefreshing && "opacity-60 pointer-events-none")}>
      {/* Summary line */}
      {data.meta.from != null && data.meta.to != null && (
        <p className="text-sm text-muted-foreground">
          {t("showing", { from: data.meta.from, to: data.meta.to, total: data.meta.total })}
        </p>
      )}

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">{t("columns.id")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead>{t("columns.issues")}</TableHead>
              <TableHead>{t("columns.store")}</TableHead>
              <TableHead>Creator</TableHead>
              <TableHead>{t("columns.createdAt")}</TableHead>
              {canCancelTicket && <TableHead className="text-end">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                onClick={onTicketClick}
                onChanged={onRowChanged}
                canCancelTicket={canCancelTicket}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data.meta.lastPage > 1 && (
        <PaginationBar
          meta={data.meta}
          currentPage={currentPage}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
