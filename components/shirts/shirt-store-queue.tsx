"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { AlertCircle, History, MoreHorizontal, Pencil } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { shirtMilestoneService } from "@/lib/api/services/shirt-milestone.service";
import {
  SHIRT_STATUS_LABELS,
  milestoneMonthLabel,
  shirtActionsFor,
  shirtEmployeeName,
  toPlainDate,
} from "@/lib/shirts/shirt-utils";
import type { ShirtAction } from "@/lib/shirts/shirt-utils";
import {
  DueCell,
  ShirtEmptyState,
  ShirtQueueSkeleton,
  ShirtStatusBadge,
} from "@/components/shirts/shirt-ui";
import type {
  ShirtMilestone,
  ShirtMilestoneSource,
  ShirtMilestoneStatus,
} from "@/types/shirt-milestone.types";

const COLUMNS = ["Employee", "Store #", "Milestone", "Due", "Status"];
const PER_PAGE = 25;

/** Oldest due date first; rows with no due date sort last, as the API does. */
function byDueDate(a: ShirtMilestone, b: ShirtMilestone): number {
  const da = toPlainDate(a.due_date);
  const db = toPlainDate(b.due_date);
  if (da === db) return a.id - b.id;
  if (da === null) return 1;
  if (db === null) return -1;
  return da < db ? -1 : 1;
}

export interface ShirtStoreQueueProps {
  active: boolean;
  /** Store NUMBERS, not PKs. */
  storeNumbers: string[];
  highlightId: number | null;
  perms: { canFill: boolean; canFulfil: boolean };
  refreshToken: number;
  onOpen: (m: ShirtMilestone) => void;
  onAction: (action: ShirtAction, m: ShirtMilestone) => void;
  onViewHistory: (m: ShirtMilestone) => void;
  onLoadedChange?: (loaded: boolean) => void;
  onRowsChange?: (rows: ShirtMilestone[]) => void;
}

/**
 * Screen 1 — the store manager's queue.
 *
 * The endpoint is one store per call, so a multi-store selection fans out and
 * merges. With exactly one store selected we let the server paginate; with
 * several we pull one page each and paginate the merged list locally, because
 * there is no cross-store page to ask for.
 */
export function ShirtStoreQueue({
  active,
  storeNumbers,
  highlightId,
  perms,
  refreshToken,
  onOpen,
  onAction,
  onViewHistory,
  onLoadedChange,
  onRowsChange,
}: ShirtStoreQueueProps) {
  const [rows, setRows] = useState<ShirtMilestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedStores, setFailedStores] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [serverLastPage, setServerLastPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  /* Filters */
  const [status, setStatus] = useState<ShirtMilestoneStatus | "all">("all");
  const [source, setSource] = useState<ShirtMilestoneSource | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const singleStore = storeNumbers.length === 1;

  const fetchData = useCallback(
    async (targetPage: number) => {
      if (storeNumbers.length === 0) {
        setRows([]);
        setIsLoading(false);
        setLoadedOnce(true);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);
      setFailedStores([]);

      const filters = {
        ...(status !== "all" ? { status } : {}),
        ...(source !== "all" ? { source } : {}),
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        per_page: PER_PAGE,
        ...(singleStore ? { page: targetPage } : {}),
      };

      try {
        const results = await Promise.allSettled(
          storeNumbers.map((sn) =>
            shirtMilestoneService
              .getStoreQueue(sn, filters, controller.signal)
              .then((res) => ({ sn, res })),
          ),
        );

        if (controller.signal.aborted) return;

        const ok = results.flatMap((r) =>
          r.status === "fulfilled" ? [r.value] : [],
        );
        // One store 403ing should not blank the whole table.
        const failed = storeNumbers.filter((sn) => !ok.some((o) => o.sn === sn));

        const merged = ok.flatMap((o) => o.res.data).sort(byDueDate);
        setRows(merged);
        setFailedStores(failed);
        setServerLastPage(singleStore ? (ok[0]?.res.last_page ?? 1) : 1);
        setPage(singleStore ? (ok[0]?.res.current_page ?? 1) : targetPage);

        if (ok.length === 0 && storeNumbers.length > 0) {
          setError("Could not load the shirt milestone queue.");
        }
      } catch (err: unknown) {
        if (axios.isCancel(err)) return;
        setError("Could not load the shirt milestone queue.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setLoadedOnce(true);
        }
      }
    },
    [storeNumbers, status, source, debouncedSearch, singleStore],
  );

  useEffect(() => {
    if (!active) {
      setLoadedOnce(false);
      return;
    }
    fetchData(1);
    return () => abortRef.current?.abort();
  }, [active, fetchData, refreshToken]);

  useEffect(() => {
    onLoadedChange?.(loadedOnce && !isLoading);
  }, [loadedOnce, isLoading, onLoadedChange]);

  useEffect(() => {
    onRowsChange?.(rows);
  }, [rows, onRowsChange]);

  /* With several stores the server cannot paginate a merged list for us. */
  const visibleRows = useMemo(() => {
    if (singleStore) return rows;
    const start = (page - 1) * PER_PAGE;
    return rows.slice(start, start + PER_PAGE);
  }, [rows, page, singleStore]);

  const lastPage = singleStore
    ? serverLastPage
    : Math.max(1, Math.ceil(rows.length / PER_PAGE));

  const hasFilters = status !== "all" || source !== "all" || debouncedSearch !== "";
  const isEmpty = loadedOnce && !isLoading && !error && rows.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as ShirtMilestoneStatus | "all")}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(SHIRT_STATUS_LABELS) as ShirtMilestoneStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SHIRT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={source}
          onValueChange={(v) => setSource(v as ShirtMilestoneSource | "all")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="automatic">Automatic</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employee…"
          className="w-[200px]"
        />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("all");
              setSource("all");
              setSearch("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {failedStores.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Some stores could not be loaded</AlertTitle>
          <AlertDescription>{failedStores.join(", ")}</AlertDescription>
        </Alert>
      )}

      {(!loadedOnce || isLoading) && <ShirtQueueSkeleton columns={COLUMNS} />}

      {isEmpty && !hasFilters && (
        <ShirtEmptyState>No shirt milestones found.</ShirtEmptyState>
      )}
      {isEmpty && hasFilters && (
        <ShirtEmptyState>No milestones match the selected filters.</ShirtEmptyState>
      )}

      {!isLoading && !error && visibleRows.length > 0 && (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  {!singleStore && <TableHead>Store #</TableHead>}
                  <TableHead>Milestone</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((m) => {
                  const actions = shirtActionsFor(m.status, perms);
                  return (
                    <TableRow
                      key={m.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-shadow",
                        highlightId === m.id && "ring-2 ring-inset ring-primary",
                      )}
                      onClick={() => onOpen(m)}
                    >
                      <TableCell>{shirtEmployeeName(m.employee)}</TableCell>
                      {!singleStore && (
                        <TableCell>{m.store?.store_number ?? "—"}</TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline">
                          {milestoneMonthLabel(m.milestone_month)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DueCell due={m.due_date} />
                      </TableCell>
                      <TableCell>
                        <ShirtStatusBadge status={m.status} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {actions.includes("entry") && (
                              <DropdownMenuItem onClick={() => onAction("entry", m)}>
                                <Pencil className="me-2 h-4 w-4" />
                                Fill Entry
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onViewHistory(m)}>
                              <History className="me-2 h-4 w-4" />
                              Shirt History
                            </DropdownMenuItem>
                            {actions
                              .filter((a) => a !== "entry")
                              .map((a) => (
                                <DropdownMenuItem
                                  key={a}
                                  onClick={() => onAction(a, m)}
                                  className={a === "cancel" ? "text-destructive" : ""}
                                >
                                  {a === "order"
                                    ? "Order"
                                    : a === "reschedule"
                                      ? "Change Delivery Date"
                                      : a === "deliver"
                                        ? "Mark Delivered"
                                        : "Cancel"}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {lastPage > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page} of {lastPage}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() =>
                    singleStore ? fetchData(page - 1) : setPage((p) => p - 1)
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() =>
                    singleStore ? fetchData(page + 1) : setPage((p) => p + 1)
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
