"use client";

import { format } from "date-fns";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Pencil,
  TriangleAlert,
} from "lucide-react";
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
import { entryTotal, formatMoney } from "@/lib/daily-pay/money";
import type { DailyPayListResponse, DailyPayEntry } from "@/types/daily-pay.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** Formats a plain "YYYY-MM-DD" workday date without shifting to a UTC day boundary. */
function formatDateOnly(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : format(d, "MMM d, yyyy");
  }
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy");
}

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, "MMM d, yyyy");
}

/**
 * Payee names for a row. The list endpoint returns payments (and their money)
 * but NOT lines, so stores and hours — which only exist on a line — cannot be
 * shown here at all. Those columns were removed rather than left permanently
 * blank, which reads as a bug.
 */
function payeeNames(entry: DailyPayEntry): string[] {
  const set = new Set<string>();
  for (const payment of entry.payments ?? []) {
    const name = payment.technician?.name;
    if (name) set.add(name);
  }
  return Array.from(set);
}

function warningCount(entry: DailyPayEntry): number | null {
  if (entry.payments == null) return null;
  let total = 0;
  let anyLoaded = false;
  for (const payment of entry.payments) {
    if (payment.aggregationWarnings == null) continue;
    anyLoaded = true;
    total += payment.aggregationWarnings.length;
  }
  return anyLoaded ? total : null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Pagination                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

interface PaginationProps {
  meta: DailyPayListResponse["meta"];
  currentPage: number;
  onPageChange: (page: number) => void;
}

function PaginationBar({ meta, currentPage, onPageChange }: PaginationProps) {
  const isFirst = currentPage <= 1;
  const isLast = currentPage >= meta.lastPage;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
      <p className="text-sm text-muted-foreground">
        Page {currentPage} of {meta.lastPage}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={isFirst}
          onClick={() => onPageChange(1)}
          aria-label="First page"
        >
          <ChevronFirst className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={isFirst}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={isLast}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={isLast}
          onClick={() => onPageChange(meta.lastPage)}
          aria-label="Last page"
        >
          <ChevronLast className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Names cell — shows up to 2 badges + "+N"                                */
/* ────────────────────────────────────────────────────────────────────────── */

function NamesCell({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="opacity-40">—</span>;
  const shown = names.slice(0, 2);
  const extra = names.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((n) => (
        <Badge key={n} variant="secondary" className="font-normal">
          {n}
        </Badge>
      ))}
      {extra > 0 && (
        <Badge variant="outline" className="font-normal">
          +{extra}
        </Badge>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Row                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

interface RowProps {
  entry: DailyPayEntry;
  onClick: (entry: DailyPayEntry) => void;
  onEdit: (entry: DailyPayEntry) => void;
  canEdit?: boolean;
  showWarnings: boolean;
}

function DailyPayRow({ entry, onClick, onEdit, canEdit = true, showWarnings }: RowProps) {
  const payments = entry.payments;
  const warnings = warningCount(entry);
  return (
    <TableRow
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => onClick(entry)}
    >
      <TableCell className="font-mono text-sm font-medium">#{entry.id}</TableCell>
      <TableCell className="whitespace-nowrap text-sm font-medium">
        {formatDateOnly(entry.date)}
      </TableCell>
      <TableCell className="text-sm">
        {payments == null ? (
          <span className="opacity-40">—</span>
        ) : (
          `${payments.length} ${payments.length === 1 ? "payment" : "payments"}`
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <NamesCell names={payeeNames(entry)} />
      </TableCell>
      {/* The payable figure — NOT the old hand-summed gas+invoices+money_owed,
          which was both the wrong number and built on a dropped field. */}
      <TableCell className="whitespace-nowrap text-sm font-medium tabular-nums">
        {formatMoney(entryTotal(entry))}
      </TableCell>
      {showWarnings && (
        <TableCell className="whitespace-nowrap text-sm">
          {warnings != null && warnings > 0 ? (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 bg-amber-500/10 font-normal text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
            >
              <TriangleAlert className="h-3 w-3" />
              {warnings}
            </Badge>
          ) : (
            <span className="opacity-40">—</span>
          )}
        </TableCell>
      )}
      <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground sm:table-cell">
        {formatDate(entry.createdAt)}
      </TableCell>
      {canEdit && (
        <TableCell>
          <div
            className="flex items-center justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              onClick={() => onEdit(entry)}
            >
              <Pencil className="me-1 h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main export                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export interface DailyPayTableProps {
  data: DailyPayListResponse;
  isRefreshing: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  onRowClick: (entry: DailyPayEntry) => void;
  onEdit: (entry: DailyPayEntry) => void;
  canEdit?: boolean;
}

export function DailyPayTable({
  data,
  isRefreshing,
  currentPage,
  onPageChange,
  onRowClick,
  onEdit,
  canEdit = true,
}: DailyPayTableProps) {
  // Only render the Warnings column when at least one row actually carries a
  // loaded warnings relation — otherwise it is a column of blanks.
  const showWarnings = data.data.some((entry) =>
    (entry.payments ?? []).some((p) => p.aggregationWarnings != null)
  );

  return (
    <div
      className={cn(
        "space-y-3 transition-opacity",
        isRefreshing && "opacity-60 pointer-events-none"
      )}
    >
      {data.meta.from != null && data.meta.to != null && (
        <p className="text-sm text-muted-foreground">
          Showing {data.meta.from}–{data.meta.to} of {data.meta.total}
        </p>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Payments</TableHead>
              <TableHead className="hidden md:table-cell">Payees</TableHead>
              <TableHead>Total Amount</TableHead>
              {showWarnings && <TableHead>Warnings</TableHead>}
              <TableHead className="hidden sm:table-cell">Created</TableHead>
              {canEdit && <TableHead className="text-end">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((entry) => (
              <DailyPayRow
                key={entry.id}
                entry={entry}
                onClick={onRowClick}
                onEdit={onEdit}
                canEdit={canEdit}
                showWarnings={showWarnings}
              />
            ))}
          </TableBody>
        </Table>
      </div>

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
