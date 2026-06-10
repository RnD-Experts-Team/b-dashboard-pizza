"use client";

import { format } from "date-fns";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Pencil,
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
import type { DailyPayListResponse, DailyPayEntry } from "@/types/daily-pay.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, "MMM d, yyyy");
}

function uniqueNames(entry: DailyPayEntry, kind: "tech" | "store"): string[] {
  const set = new Set<string>();
  for (const line of entry.lines) {
    if (kind === "tech") {
      const name = line.technician?.name;
      if (name) set.add(name);
    } else {
      const num = line.store?.storeNumber;
      if (num) set.add(num);
    }
  }
  return Array.from(set);
}

function totalOwed(entry: DailyPayEntry): number {
  return entry.lines.reduce((sum, l) => sum + (l.moneyOwed ?? 0), 0);
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
}

function DailyPayRow({ entry, onClick, onEdit, canEdit = true }: RowProps) {
  return (
    <TableRow
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => onClick(entry)}
    >
      <TableCell className="font-mono text-sm font-medium">#{entry.id}</TableCell>
      <TableCell className="whitespace-nowrap text-sm font-medium">
        {formatDate(entry.date)}
      </TableCell>
      <TableCell className="text-sm">
        {entry.lines.length} {entry.lines.length === 1 ? "line" : "lines"}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <NamesCell names={uniqueNames(entry, "tech")} />
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <NamesCell names={uniqueNames(entry, "store")} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm tabular-nums">
        ${totalOwed(entry).toFixed(2)}
      </TableCell>
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
              <TableHead>Lines</TableHead>
              <TableHead className="hidden md:table-cell">Technicians</TableHead>
              <TableHead className="hidden lg:table-cell">Stores</TableHead>
              <TableHead>Total Owed</TableHead>
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
