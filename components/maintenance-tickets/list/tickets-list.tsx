"use client";

import { ChevronLeft, ChevronRight, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTimestamp } from "@/lib/utils/date-display";
import { isOverdue } from "@/lib/maintenance-workflow";
import type { IssueStatus, Ticket, TicketIssueSummary, TicketsListResponse } from "@/types/maintenance-tickets.types";
import { PriorityBadge, StatusBadge } from "../ticket/ticket-top";

/** Most severe first; a priority's rank is how far from the end it sits. */
const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;
const PRIORITY_RANK: Record<string, number> = Object.fromEntries(PRIORITY_ORDER.map((p, i) => [p, PRIORITY_ORDER.length - i]));
const DATE_PATTERN = "MMM d, yyyy";

/** The highest priority across the ticket's issues. */
function topPriority(issues: TicketIssueSummary[]): { value: string; label: string } | null {
  return issues.reduce<{ value: string; label: string } | null>((best, i) => {
    if (!i.priority) return best;
    return !best || (PRIORITY_RANK[i.priority.value] ?? 0) > (PRIORITY_RANK[best.value] ?? 0) ? i.priority : best;
  }, null);
}

/** The earliest target among the issues still open. */
function nearestTarget(issues: TicketIssueSummary[]): string | null {
  return (
    issues
      .map((i) => i.targetCompletionAt ?? null)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ?? null
  );
}

function assignedNames(issues: TicketIssueSummary[]): string {
  const names = issues.flatMap((i) => i.technicians.map((tech) => tech.name));
  return [...new Set(names)].join(", ");
}

interface RowView {
  ticket: Ticket;
  title: string;
  more: number;
  store: string;
  priority: { value: string; label: string } | null;
  assigned: string;
  target: string | null;
  overdue: boolean;
}

function viewOf(ticket: Ticket): RowView {
  const target = nearestTarget(ticket.issues);
  return {
    ticket,
    title: ticket.issues[0]?.title ?? ticket.issueTitles[0] ?? `#${ticket.id}`,
    more: Math.max(0, ticket.issueCount - 1),
    store: ticket.storeId ?? ticket.otherStore ?? "—",
    priority: topPriority(ticket.issues),
    assigned: assignedNames(ticket.issues),
    target,
    overdue: isOverdue(target, ticket.status.value as IssueStatus),
  };
}

function TargetCell({ row }: { row: RowView }) {
  const t = useTranslations("maintenanceV2");
  if (!row.target) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("tabular-nums", row.overdue && "font-medium text-orange-700 dark:text-orange-400")}>
      {formatTimestamp(row.target, DATE_PATTERN)}
      {row.overdue ? <span className="sr-only"> ({t("tickets.attention.overdue")})</span> : null}
    </span>
  );
}

export function TicketsList({
  data,
  isRefreshing,
  currentPage,
  onPageChange,
  onOpen,
}: {
  data: TicketsListResponse;
  isRefreshing: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  onOpen: (ticket: Ticket) => void;
}) {
  const t = useTranslations("maintenanceV2");
  const rows = data.data.map(viewOf);
  const { meta } = data;

  return (
    <div className={cn("space-y-3 transition-opacity", isRefreshing && "pointer-events-none opacity-60")}>
      {meta.from != null && meta.to != null ? (
        <p className="text-sm text-muted-foreground tabular-nums">{t("tickets.list.showing", { from: meta.from, to: meta.to, total: meta.total })}</p>
      ) : null}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">{t("tickets.list.columns.number")}</TableHead>
              <TableHead>{t("tickets.list.columns.title")}</TableHead>
              <TableHead>{t("common.store")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("common.priority")}</TableHead>
              <TableHead>{t("tickets.assignedTo")}</TableHead>
              <TableHead>{t("tickets.targetDate")}</TableHead>
              <TableHead>{t("tickets.updated")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.ticket.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onOpen(row.ticket)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpen(row.ticket);
                }}
                tabIndex={0}
                aria-label={t("tickets.list.openTicket", { id: row.ticket.id })}
              >
                <TableCell className="font-mono text-sm tabular-nums">#{row.ticket.id}</TableCell>
                <TableCell className="max-w-72">
                  <span className="block truncate font-medium" title={row.title}>
                    {row.title}
                  </span>
                  {row.more ? <span className="text-xs text-muted-foreground">{t("tickets.moreIssues", { count: row.more })}</span> : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{row.store}</TableCell>
                <TableCell>
                  <StatusBadge status={row.ticket.status.value} label={row.ticket.status.label} />
                </TableCell>
                <TableCell>{row.priority ? <PriorityBadge priority={row.priority.value} label={row.priority.label} /> : "—"}</TableCell>
                <TableCell className="max-w-40 truncate text-sm">{row.assigned || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  <TargetCell row={row} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                  {formatTimestamp(row.ticket.updatedAt, DATE_PATTERN)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.ticket.id}>
            <button
              type="button"
              onClick={() => onOpen(row.ticket)}
              className="w-full space-y-2 rounded-lg border bg-card p-3 text-start transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground tabular-nums">#{row.ticket.id}</p>
                  <p className="truncate font-medium">{row.title}</p>
                  {row.more ? <p className="text-xs text-muted-foreground">{t("tickets.moreIssues", { count: row.more })}</p> : null}
                </div>
                <StatusBadge status={row.ticket.status.value} label={row.ticket.status.label} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Store className="h-3 w-3" aria-hidden="true" />
                  {row.store}
                </span>
                {row.priority ? <PriorityBadge priority={row.priority.value} label={row.priority.label} /> : null}
                {row.target ? (
                  <span>
                    {t("tickets.targetDate")}: <TargetCell row={row} />
                  </span>
                ) : null}
                {row.assigned ? <span className="truncate">{row.assigned}</span> : null}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {meta.lastPage > 1 ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-sm text-muted-foreground tabular-nums">{t("tickets.list.page", { current: currentPage, total: meta.lastPage })}</p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              aria-label={t("tickets.list.previous")}
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={currentPage >= meta.lastPage}
              onClick={() => onPageChange(currentPage + 1)}
              aria-label={t("tickets.list.next")}
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
