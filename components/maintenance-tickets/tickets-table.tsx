"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TicketsListResponse, Ticket, TicketStatus } from "@/types/maintenance-tickets.types";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Status badge                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

const STATUS_VARIANTS: Record<TicketStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  assigned: "secondary",
  in_progress: "default",
  complete: "default",
};

const STATUS_CLASSES: Record<TicketStatus, string> = {
  pending: "border-yellow-400 text-yellow-600 dark:text-yellow-400",
  assigned: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  in_progress: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  complete: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("maintenanceTickets.status");
  const key = status as TicketStatus;
  return (
    <Badge
    //   variant={STATUS_VARIANTS[key] ?? "outline"}
    //   className={cn("capitalize whitespace-nowrap", STATUS_CLASSES[key])}
    >
        
      {t(key as keyof ReturnType<typeof useTranslations<"maintenanceTickets.status">>)}
    </Badge>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Table row                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

interface TicketRowProps {
  ticket: Ticket;
  onClick: (ticket: Ticket) => void;
  onChanged: () => void;
}

function TicketRow({ ticket, onClick, onChanged }: TicketRowProps) {
  const t = useTranslations("maintenanceTickets");

  async function handleDelete() {
    await maintenanceTicketsService.deleteTicket(ticket.storeId, ticket.id);
    onChanged();
  }

  async function handleRestore() {
    await maintenanceTicketsService.restoreTicket(ticket.storeId, ticket.id);
    onChanged();
  }

  return (
    <TableRow
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => onClick(ticket)}
    >
      <TableCell className="font-mono text-sm font-medium">#{ticket.id}</TableCell>
      <TableCell>
        <StatusBadge status={ticket.status.value} />
      </TableCell>
      <TableCell>
        <span className="text-sm">
          {ticket.issueCount} {t("columns.issuesCount")}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{ticket.storeId}</TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {format(new Date(ticket.createdAt), "MMM d, yyyy")}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {ticket.deletedAt ? (
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleRestore}>
              <RotateCcw className="h-3.5 w-3.5 me-1" />
              Restore
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5 me-1" />
              Delete
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
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
}

export function TicketsTable({
  data,
  isRefreshing,
  currentPage,
  onPageChange,
  onTicketClick,
  onRowChanged,
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
              <TableHead>{t("columns.createdAt")}</TableHead>
              <TableHead className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                onClick={onTicketClick}
                onChanged={onRowChanged}
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
