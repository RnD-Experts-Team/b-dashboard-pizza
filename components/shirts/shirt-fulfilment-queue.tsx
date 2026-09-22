"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  CalendarClock,
  History,
  MoreHorizontal,
  PackageCheck,
  ShoppingCart,
  X,
} from "lucide-react";
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
  formatPlainDate,
  milestoneMonthLabel,
  shirtActionsFor,
  shirtEmployeeName,
} from "@/lib/shirts/shirt-utils";
import type { ShirtAction } from "@/lib/shirts/shirt-utils";
import {
  ColorSwatch,
  DueCell,
  LogoThumb,
  ShirtEmptyState,
  ShirtQueueSkeleton,
  ShirtStatusBadge,
} from "@/components/shirts/shirt-ui";
import type {
  ShirtMilestone,
  ShirtMilestoneStatus,
} from "@/types/shirt-milestone.types";

const COLUMNS = ["Employee", "Store #", "Milestone", "Due", "Shirt", "Status"];
const PER_PAGE = 25;

export interface ShirtFulfilmentQueueProps {
  active: boolean;
  highlightId: number | null;
  perms: { canFill: boolean; canFulfil: boolean };
  refreshToken: number;
  onOpen: (m: ShirtMilestone) => void;
  onAction: (action: ShirtAction, m: ShirtMilestone) => void;
  onViewHistory: (m: ShirtMilestone) => void;
}

/**
 * Screen 3 — the HQ cross-store fulfilment queue.
 *
 * One call, already cross-store. Defaults to `submitted` because that is the
 * actual work queue: entries waiting to be ordered.
 *
 * Expect 403 until the "Employee Obsession" role is granted on the auth server
 * against the api.v1.shirt-milestones.* route names — that is a role grant, not
 * a frontend change, and nothing about the contract changes when it lands.
 */
export function ShirtFulfilmentQueue({
  active,
  highlightId,
  perms,
  refreshToken,
  onOpen,
  onAction,
  onViewHistory,
}: ShirtFulfilmentQueueProps) {
  const [rows, setRows] = useState<ShirtMilestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  const [status, setStatus] = useState<ShirtMilestoneStatus | "all">("submitted");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [storeFilters, setStoreFilters] = useState<string[]>([]);
  const [storeDraft, setStoreDraft] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(
    async (targetPage: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);
      setForbidden(false);

      try {
        const res = await shirtMilestoneService.getFulfilmentQueue(
          {
            ...(status !== "all" ? { status } : {}),
            ...(debouncedSearch ? { q: debouncedSearch } : {}),
            ...(storeFilters.length ? { stores: storeFilters } : {}),
            page: targetPage,
            per_page: PER_PAGE,
          },
          controller.signal,
        );
        setRows(res.data);
        setLastPage(res.last_page);
        setPage(res.current_page);
      } catch (err: unknown) {
        if (axios.isCancel(err)) return;
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          setForbidden(true);
        } else {
          setError("Could not load the fulfilment queue.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setLoadedOnce(true);
        }
      }
    },
    [status, debouncedSearch, storeFilters],
  );

  useEffect(() => {
    if (!active) {
      setLoadedOnce(false);
      return;
    }
    fetchData(1);
    return () => abortRef.current?.abort();
  }, [active, fetchData, refreshToken]);

  const isEmpty = loadedOnce && !isLoading && !error && !forbidden && rows.length === 0;

  function addStoreFilter() {
    const value = storeDraft.trim();
    if (!value || storeFilters.includes(value)) return;
    setStoreFilters((prev) => [...prev, value]);
    setStoreDraft("");
  }

  return (
    <div className="flex flex-col gap-4">
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

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employee…"
          className="w-[200px]"
        />

        {/* HQ users have no overviewStores to pick from, so store numbers are
            typed in and shown as removable chips. */}
        <Input
          value={storeDraft}
          onChange={(e) => setStoreDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addStoreFilter();
            }
          }}
          placeholder="Filter by store #…"
          className="w-[180px]"
        />
        <Button variant="outline" size="sm" onClick={addStoreFilter}>
          Add store
        </Button>

        {storeFilters.map((s) => (
          <Badge key={s} variant="secondary" className="gap-1">
            {s}
            <button
              type="button"
              aria-label={`Remove ${s}`}
              onClick={() => setStoreFilters((prev) => prev.filter((x) => x !== s))}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {forbidden && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No access to the fulfilment queue</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              Fulfilment access is granted on the auth server against the
              api.v1.shirt-milestones.* route names.
            </span>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => fetchData(1)}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => fetchData(page)}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {(!loadedOnce || isLoading) && <ShirtQueueSkeleton columns={COLUMNS} />}

      {isEmpty && <ShirtEmptyState>Nothing in this queue right now.</ShirtEmptyState>}

      {!isLoading && !error && !forbidden && rows.length > 0 && (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => {
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
                      <TableCell>{m.store?.store_number ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {milestoneMonthLabel(m.milestone_month)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DueCell due={m.due_date} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ColorSwatch
                            hex={m.shirt_color?.hex_code}
                            name={m.shirt_color?.name}
                          />
                          <LogoThumb logo={m.shirt_logo} />
                          <span className="text-xs text-muted-foreground">
                            {m.t_shirt_size ?? "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <ShirtStatusBadge status={m.status} />
                          {/* Rescheduling happens often enough that burying it
                              in a menu would be the wrong call. */}
                          {m.status === "ordered" && perms.canFulfil && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAction("reschedule", m);
                              }}
                            >
                              <CalendarClock className="me-1 h-3 w-3" />
                              {formatPlainDate(m.delivery_date)}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {m.status === "submitted" && perms.canFulfil && (
                            <Button
                              size="sm"
                              onClick={() => onAction("order", m)}
                              className="h-7"
                            >
                              <ShoppingCart className="me-1 h-3 w-3" />
                              Order
                            </Button>
                          )}
                          {m.status === "ordered" && perms.canFulfil && (
                            <Button
                              size="sm"
                              onClick={() => onAction("deliver", m)}
                              className="h-7"
                            >
                              <PackageCheck className="me-1 h-3 w-3" />
                              Deliver
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onViewHistory(m)}>
                                <History className="me-2 h-4 w-4" />
                                Shirt History
                              </DropdownMenuItem>
                              {actions.includes("cancel") && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => onAction("cancel", m)}
                                >
                                  Cancel Milestone
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
                  onClick={() => fetchData(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => fetchData(page + 1)}
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
