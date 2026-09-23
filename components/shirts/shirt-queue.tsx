"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  CalendarClock,
  History,
  MoreHorizontal,
  PackageCheck,
  Pencil,
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
  ShirtMilestoneSource,
  ShirtMilestoneStatus,
} from "@/types/shirt-milestone.types";

const PER_PAGE = 25;

const ACTION_MENU_LABEL: Record<ShirtAction, string> = {
  entry: "Fill Entry",
  order: "Order",
  reschedule: "Change Delivery Date",
  deliver: "Mark Delivered",
  cancel: "Cancel Milestone",
};

export interface ShirtQueueProps {
  active: boolean;
  /** The user's own store NUMBERS — the multi-store read's scope. */
  storeNumbers: string[];
  /**
   * True when this user genuinely holds cross-store fulfilment access, so the
   * queue reads the every-store fulfilment endpoint instead of their own stores.
   */
  crossStore: boolean;
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
 * The shirt milestone queue — one list for both store managers and HQ
 * fulfilment.
 *
 * They are the same rows of the same entity; what differs is only which
 * endpoint can serve them and which actions the viewer is permitted, and both
 * of those are decided elsewhere (shirt-access.ts for the source, and
 * status x permission per row for the actions). So this is one component:
 *
 *   crossStore  -> GET /v1/shirt-milestones                      (every store)
 *   otherwise   -> GET /v1/store-shirt-milestones?storeIds[]=…   (the user's
 *                  selected stores, one call — same as hiring/separation requests)
 *
 * Both are a single request paginated by the server. If the cross-store call
 * 403s — the fulfilment role not yet granted, or an auth rule not registered —
 * it falls back to the user's own stores rather than showing an empty table,
 * and keeps the hint about where the grant lives.
 */
export function ShirtQueue({
  active,
  storeNumbers,
  crossStore,
  highlightId,
  perms,
  refreshToken,
  onOpen,
  onAction,
  onViewHistory,
  onLoadedChange,
  onRowsChange,
}: ShirtQueueProps) {
  const [rows, setRows] = useState<ShirtMilestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [fellBack, setFellBack] = useState(false);
  const [page, setPage] = useState(1);
  const [serverLastPage, setServerLastPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  // The cross-store call degraded to the fan-out; stay there for the session.
  const readsCrossStore = crossStore && !fellBack;

  /* Filters. Fulfilment users open on the work queue; everyone else sees the
     whole pipeline for their stores. */
  const [status, setStatus] = useState<ShirtMilestoneStatus | "all">(
    crossStore ? "submitted" : "all",
  );
  const [source, setSource] = useState<ShirtMilestoneSource | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  /** Extra store numbers typed in — HQ users have no store list to pick from. */
  const [extraStores, setExtraStores] = useState<string[]>([]);
  const [storeDraft, setStoreDraft] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const scopedStores = useMemo(
    () => [...new Set([...storeNumbers, ...extraStores])],
    [storeNumbers, extraStores],
  );

  const fetchData = useCallback(
    async (targetPage: number) => {
      if (!readsCrossStore && storeNumbers.length === 0) {
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

      const filters = {
        ...(status !== "all" ? { status } : {}),
        ...(source !== "all" ? { source } : {}),
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        per_page: PER_PAGE,
      };

      try {
        if (readsCrossStore) {
          const res = await shirtMilestoneService.getFulfilmentQueue(
            {
              ...filters,
              // No stores[] at all means every store, which is the point of
              // this view; narrow only when the user asked for it.
              ...(scopedStores.length ? { stores: scopedStores } : {}),
              page: targetPage,
            },
            controller.signal,
          );
          setRows(res.data);
          setServerLastPage(res.last_page);
          setPage(res.current_page);
          setForbidden(false);
          return;
        }

        // One call for all of the user's selected stores — the backend sorts
        // and paginates across them, same as the hiring/separation requests.
        const res = await shirtMilestoneService.getStoresQueue(
          storeNumbers,
          { ...filters, page: targetPage },
          controller.signal,
        );
        setRows(res.data);
        setServerLastPage(res.last_page);
        setPage(res.current_page);
      } catch (err: unknown) {
        if (axios.isCancel(err)) return;
        if (readsCrossStore && axios.isAxiosError(err) && err.response?.status === 403) {
          // Degrade to the user's own stores instead of an empty table. If they
          // have none, the grant hint below is all we can usefully show.
          setFellBack(true);
          if (storeNumbers.length === 0) setForbidden(true);
          return;
        }
        setError("Could not load the shirt milestone queue.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setLoadedOnce(true);
        }
      }
    },
    [
      readsCrossStore,
      storeNumbers,
      scopedStores,
      status,
      source,
      debouncedSearch,
    ],
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

  const lastPage = serverLastPage;

  const showStoreColumn = readsCrossStore || storeNumbers.length > 1;
  const hasFilters =
    status !== "all" || source !== "all" || debouncedSearch !== "" || extraStores.length > 0;
  const isEmpty =
    loadedOnce && !isLoading && !error && !forbidden && rows.length === 0;

  function goToPage(next: number) {
    fetchData(next);
  }

  function addStoreFilter() {
    const value = storeDraft.trim();
    if (!value || scopedStores.includes(value)) return;
    setExtraStores((prev) => [...prev, value]);
    setStoreDraft("");
  }

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

        {/* Only the cross-store read accepts a stores[] filter, and only there
            can a user meaningfully ask for a store that is not their own. */}
        {readsCrossStore && (
          <>
            <Input
              value={storeDraft}
              onChange={(e) => setStoreDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addStoreFilter();
                }
              }}
              placeholder="Add store #…"
              className="w-[160px]"
            />
            {extraStores.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1">
                {s}
                <button
                  type="button"
                  aria-label={`Remove ${s}`}
                  onClick={() => setExtraStores((prev) => prev.filter((x) => x !== s))}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </>
        )}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("all");
              setSource("all");
              setSearch("");
              setExtraStores([]);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {forbidden && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No access to the cross-store queue</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              Fulfilment access is granted on the auth server against the
              api.v1.shirt-milestones.* route names.
            </span>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => {
                setFellBack(false);
                setForbidden(false);
                fetchData(1);
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {fellBack && !forbidden && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Showing your stores only</AlertTitle>
          <AlertDescription>
            The cross-store queue refused the request. Fulfilment access is granted
            on the auth server against the api.v1.shirt-milestones.* route names.
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

      {(!loadedOnce || isLoading) && (
        <ShirtQueueSkeleton
          columns={["Employee", "Store #", "Milestone", "Due", "Shirt", "Status"]}
        />
      )}

      {isEmpty && !hasFilters && (
        <ShirtEmptyState>No shirt milestones found.</ShirtEmptyState>
      )}
      {isEmpty && hasFilters && (
        <ShirtEmptyState>No milestones match the selected filters.</ShirtEmptyState>
      )}

      {!isLoading && !error && rows.length > 0 && (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  {showStoreColumn && <TableHead>Store #</TableHead>}
                  <TableHead>Milestone</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Shirt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => {
                  const actions = shirtActionsFor(m.status, perms);
                  // One primary action inline, the rest in the menu. Reschedule
                  // is its own inline control in the Status cell.
                  const primary =
                    actions.find((a) => a === "entry" || a === "order" || a === "deliver") ??
                    null;
                  const menuActions = actions.filter(
                    (a) => a !== primary && a !== "reschedule",
                  );

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
                      {showStoreColumn && (
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
                          {actions.includes("reschedule") && (
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
                          {primary === "entry" && (
                            <Button
                              size="sm"
                              className="h-7"
                              onClick={() => onAction("entry", m)}
                            >
                              <Pencil className="me-1 h-3 w-3" />
                              Fill Entry
                            </Button>
                          )}
                          {primary === "order" && (
                            <Button
                              size="sm"
                              className="h-7"
                              onClick={() => onAction("order", m)}
                            >
                              <ShoppingCart className="me-1 h-3 w-3" />
                              Order
                            </Button>
                          )}
                          {primary === "deliver" && (
                            <Button
                              size="sm"
                              className="h-7"
                              onClick={() => onAction("deliver", m)}
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
                              {menuActions.map((a) => (
                                <DropdownMenuItem
                                  key={a}
                                  onClick={() => onAction(a, m)}
                                  className={a === "cancel" ? "text-destructive" : ""}
                                >
                                  {ACTION_MENU_LABEL[a]}
                                </DropdownMenuItem>
                              ))}
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
                  onClick={() => goToPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => goToPage(page + 1)}
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
