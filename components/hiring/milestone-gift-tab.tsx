"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  RefreshCw,
  AlertCircle,
  MoreHorizontal,
  ClipboardList,
  Gift,
  PackageCheck,
  ListChecks,
} from "lucide-react";
import { CreateMilestoneGiftDialog } from "@/components/hiring/create-milestone-gift-dialog";
import { MilestoneGiftRatingDialog } from "@/components/hiring/milestone-gift-rating-dialog";
import { MilestoneGiftDecisionDialog } from "@/components/hiring/milestone-gift-decision-dialog";
import { MilestoneGiftFinalStatusDialog } from "@/components/hiring/milestone-gift-final-status-dialog";
import { MilestoneGiftSheet } from "@/components/hiring/milestone-gift-sheet";
import { MilestoneGiftQuestionsCatalog } from "@/components/hiring/milestone-gift-questions-catalog";
import { hiringService } from "@/lib/api/services/hiring.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useHiringActionStore } from "@/lib/store/hiring-action.store";
import { StoreMultiSelect } from "@/components/hiring/store-multi-select";
import { cn } from "@/lib/utils";
import type { StoreRequest } from "@/types/hiring.types";
import type {
  Milestone,
  MilestoneGiftStage,
} from "@/types/milestone-gift.types";

const MILESTONE_LABELS: Record<Milestone, string> = {
  "8_days": "8 Days",
  "14_days": "14 Days",
  "1_month": "1 Month",
  "2_months": "2 Months",
  "3_months": "3 Months",
  "4_months": "4 Months",
  "5_months": "5 Months",
  "6_months": "6 Months",
  "8_months": "8 Months",
  "1_year": "1 Year",
  other: "Other",
};

const STAGE_LABELS: Record<MilestoneGiftStage, string> = {
  created: "Submitted",
  rating: "Rated",
  gift_decision: "Decided",
  final_status: "Finalized",
  closed: "Closed",
  cancelled: "Cancelled",
};

function StageBadge({ stage }: { stage: MilestoneGiftStage }) {
  const variant =
    stage === "closed"
      ? "default"
      : stage === "cancelled"
        ? "destructive"
        : "secondary";
  return (
    <Badge variant={variant} className="capitalize">
      {STAGE_LABELS[stage] ?? stage}
    </Badge>
  );
}

function MgTableSkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {["Employee", "Store #", "Milestone", "Stage", "Date of Request"].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 5 }).map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function MilestoneGiftTab({
  active = true,
  fullAccess = false,
}: {
  active?: boolean;
  /** true = milestone-gift manager: all buttons + all actions visible.
   *  false = general user: no create/manage buttons, no gift-decision/final-status actions. */
  fullAccess?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<StoreRequest | null>(
    null,
  );
  const { selectedStore } = useSelectedStoreStore();
  const { canAccessRoute, overviewStores } = useAuthStore();
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;
  const canCreateMilestoneGift = canAccessRoute({
    service: "Hiring",
    method: "POST",
    path: "/v1/stores/*/milestone-gift-requests",
    storeId: effectiveStoreId,
  });

  /* Stage-action dialogs — share a selected request */
  const [actionRequest, setActionRequest] = useState<StoreRequest | null>(null);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [finalStatusDialogOpen, setFinalStatusDialogOpen] = useState(false);

  /* Question management catalog */
  const [catalogOpen, setCatalogOpen] = useState(false);

  const validStoreIds = useMemo(
    () => new Set((overviewStores ?? []).flatMap((s) => (s.storeId ? [s.storeId] : []))),
    [overviewStores],
  );

  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(() => {
    const valid = new Set((overviewStores ?? []).flatMap((s) => (s.storeId ? [s.storeId] : [])));
    const fallback = [...valid];
    try {
      const raw = localStorage.getItem("store-filter:milestone-gift");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clamped = (parsed as string[]).filter((id) => valid.has(id));
          if (clamped.length > 0) return clamped;
        }
      }
    } catch {}
    return fallback;
  });

  useEffect(() => {
    if (validStoreIds.size === 0) return;
    setSelectedStoreIds((prev) => {
      const clamped = prev.filter((id) => validStoreIds.has(id));
      return clamped.length > 0 ? clamped : [...validStoreIds];
    });
  }, [validStoreIds]);

  function handleStoreApply(ids: string[]) {
    setSelectedStoreIds(ids);
    try { localStorage.setItem("store-filter:milestone-gift", JSON.stringify(ids)); } catch {}
  }

  // ── Deep-link from a milestone_gift_request notification ────────────────
  const pendingHiringAction = useHiringActionStore((s) => s.pendingHiringAction);
  const clearPendingHiringAction = useHiringActionStore((s) => s.clearPendingHiringAction);
  const [highlightedRequestId, setHighlightedRequestId] = useState<number | null>(null);
  const [pendingHighlightId, setPendingHighlightId] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  // Effect A: apply the store filter, stash the target id locally
  useEffect(() => {
    if (!pendingHiringAction || pendingHiringAction.tab !== "milestone_gift") return;
    if (!validStoreIds.has(pendingHiringAction.storeNumber)) {
      clearPendingHiringAction();
      return;
    }
    handleStoreApply([pendingHiringAction.storeNumber]);
    setPendingHighlightId(pendingHiringAction.requestId);
    clearPendingHiringAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHiringAction, validStoreIds, clearPendingHiringAction]);

  const [rows, setRows] = useState<StoreRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  /* Frontend filters */
  const [filterStage, setFilterStage] = useState<MilestoneGiftStage | "all">("all");
  const [filterMilestone, setFilterMilestone] = useState<Milestone | "all">("all");

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const mg = r.milestone_gift_request;
      if (filterStage !== "all" && mg?.stage !== filterStage) return false;
      if (filterMilestone !== "all" && mg?.milestone !== filterMilestone) return false;
      return true;
    });
  }, [rows, filterStage, filterMilestone]);

  const fetchData = useCallback(
    async (targetPage: number) => {
      if (selectedStoreIds.length === 0) {
        setRows([]);
        setIsLoading(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const res = await hiringService.getRequests(
          selectedStoreIds,
          "milestone_gift",
          targetPage,
          undefined,
          controller.signal,
        );
        setRows(res.data);
        setTotalPages(res.last_page);
        setPage(res.current_page);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "CanceledError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load milestone gift requests.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [selectedStoreIds],
  );

  useEffect(() => {
    if (!active) {
      setIsInitialLoadComplete(false);
      return;
    }
    let cancelled = false;
    fetchData(1).finally(() => {
      if (!cancelled) setIsInitialLoadComplete(true);
    });
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [active, fetchData]);

  // Effect B: once the (re-)filtered rows land, highlight the matching row for 1.5s
  useEffect(() => {
    if (pendingHighlightId === null || !isInitialLoadComplete || isLoading) return;
    const target = rows.find((r) => r.milestone_gift_request?.id === pendingHighlightId);
    setPendingHighlightId(null);
    if (target) {
      setHighlightedRequestId(target.id);
      if (highlightTimeoutRef.current != null) window.clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedRequestId(null);
        highlightTimeoutRef.current = null;
      }, 1500);
    }
  }, [rows, pendingHighlightId, isInitialLoadComplete, isLoading]);

  const isEmpty =
    isInitialLoadComplete && !isLoading && !error && rows.length === 0;

  const actionMg = actionRequest?.milestone_gift_request ?? null;
  // Prefer store_number from the row when the backend returns it; fall back to the
  // first store in the current filter (covers the common single-store case).
  const actionStoreId = actionMg?.store?.store_number ?? selectedStoreIds[0] ?? "";
  const actionEmployeeName = actionMg?.employee
    ? `${actionMg.employee.first_name} ${actionMg.employee.last_name}`.trim()
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Actions row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <StoreMultiSelect
          stores={(overviewStores ?? []).flatMap((s) => s.storeId ? [{ storeId: s.storeId, name: s.name }] : [])}
          value={selectedStoreIds}
          onApply={handleStoreApply}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchData(page)}
            disabled={isLoading}
            aria-label="Refresh"
          >
            <RefreshCw
              className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
          </Button>
          {fullAccess && (
            <Button variant="outline" onClick={() => setCatalogOpen(true)}>
              <ListChecks className="me-2 h-4 w-4" />
              <span className="hidden sm:inline">Manage Questions</span>
              <span className="sm:hidden">Questions</span>
            </Button>
          )}
          {fullAccess && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="me-2 h-4 w-4" />
              <span className="hidden sm:inline">Create Milestone Gift</span>
              <span className="sm:hidden">New</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => fetchData(page)}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      {isInitialLoadComplete && !error && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={filterStage}
            onValueChange={(v) => setFilterStage(v as MilestoneGiftStage | "all")}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="created">{STAGE_LABELS.created}</SelectItem>
              <SelectItem value="rating">{STAGE_LABELS.rating}</SelectItem>
              <SelectItem value="gift_decision">{STAGE_LABELS.gift_decision}</SelectItem>
              <SelectItem value="final_status">{STAGE_LABELS.final_status}</SelectItem>
              <SelectItem value="closed">{STAGE_LABELS.closed}</SelectItem>
              <SelectItem value="cancelled">{STAGE_LABELS.cancelled}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filterMilestone}
            onValueChange={(v) => setFilterMilestone(v as Milestone | "all")}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="All Milestones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Milestones</SelectItem>
              <SelectItem value="8_days">8 Days</SelectItem>
              <SelectItem value="14_days">14 Days</SelectItem>
              <SelectItem value="1_month">1 Month</SelectItem>
              <SelectItem value="2_months">2 Months</SelectItem>
              <SelectItem value="3_months">3 Months</SelectItem>
              <SelectItem value="4_months">4 Months</SelectItem>
              <SelectItem value="5_months">5 Months</SelectItem>
              <SelectItem value="6_months">6 Months</SelectItem>
              <SelectItem value="8_months">8 Months</SelectItem>
              <SelectItem value="1_year">1 Year</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {(filterStage !== "all" || filterMilestone !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setFilterStage("all"); setFilterMilestone("all"); }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {(!isInitialLoadComplete || isLoading) && <MgTableSkeleton />}

      {/* Empty state */}
      {isEmpty && (
        <div className="rounded-lg border p-10 text-center text-muted-foreground text-sm">
          No milestone gift requests found.
        </div>
      )}

      {/* Filtered empty */}
      {isInitialLoadComplete && !isLoading && !error && rows.length > 0 && filteredRows.length === 0 && (
        <div className="rounded-lg border p-10 text-center text-muted-foreground text-sm">
          No requests match the selected filters.
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && filteredRows.length > 0 && (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Store #</TableHead>
                <TableHead>Milestone</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Date of Request</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((req) => {
                const mg = req.milestone_gift_request;
                const employeeName = mg?.employee
                  ? `${mg.employee.first_name} ${mg.employee.last_name}`
                  : "—";
                const stage = mg?.stage;
                const isTerminal = stage === "closed" || stage === "cancelled";
                const canRating = stage === "created";
                const canDecision = stage === "rating";
                const canFinalStatus = stage === "gift_decision" || stage === "final_status";
                return (
                  <TableRow
                    key={req.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50 transition-shadow",
                      highlightedRequestId === req.id && "ring-2 ring-inset ring-primary"
                    )}
                    onClick={() => {
                      setSelectedRequest(req);
                      setSheetOpen(true);
                    }}
                  >
                    <TableCell className="whitespace-nowrap">
                      {employeeName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {mg?.store?.store_number ?? "—"}
                    </TableCell>
                    <TableCell>
                      {mg ? (
                        <Badge variant="secondary">
                          {MILESTONE_LABELS[mg.milestone] ?? mg.milestone}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {stage ? (
                        <StageBadge stage={stage} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {req.requested_at
                        ? new Date(req.requested_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                            disabled={isTerminal}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={!canRating}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionRequest(req);
                              setRatingDialogOpen(true);
                            }}
                          >
                            <ClipboardList className="me-2 h-4 w-4" />
                            Submit Rating
                          </DropdownMenuItem>
                          {fullAccess && (
                            <DropdownMenuItem
                              disabled={!canDecision}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionRequest(req);
                                setDecisionDialogOpen(true);
                              }}
                            >
                              <Gift className="me-2 h-4 w-4" />
                              Gift Decision
                            </DropdownMenuItem>
                          )}
                          {fullAccess && (
                            <DropdownMenuItem
                              disabled={!canFinalStatus}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionRequest(req);
                                setFinalStatusDialogOpen(true);
                              }}
                            >
                              <PackageCheck className="me-2 h-4 w-4" />
                              Final Status
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !isLoading && !error && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}

      <CreateMilestoneGiftDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => fetchData(1)}
      />

      <MilestoneGiftRatingDialog
        requestId={actionMg?.id ?? null}
        storeId={actionStoreId}
        employeeName={actionEmployeeName}
        open={ratingDialogOpen}
        onOpenChange={setRatingDialogOpen}
        onSuccess={() => fetchData(page)}
      />

      <MilestoneGiftDecisionDialog
        requestId={actionMg?.id ?? null}
        storeId={actionStoreId}
        decision={actionMg?.decision ?? null}
        open={decisionDialogOpen}
        onOpenChange={setDecisionDialogOpen}
        onSuccess={() => fetchData(page)}
      />

      <MilestoneGiftFinalStatusDialog
        requestId={actionMg?.id ?? null}
        storeId={actionStoreId}
        finalStatus={actionMg?.final_status ?? null}
        open={finalStatusDialogOpen}
        onOpenChange={setFinalStatusDialogOpen}
        onSuccess={() => fetchData(page)}
      />

      <MilestoneGiftSheet
        request={selectedRequest}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <MilestoneGiftQuestionsCatalog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
      />
    </div>
  );
}
