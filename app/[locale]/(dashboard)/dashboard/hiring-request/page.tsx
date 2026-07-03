"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  RefreshCw,
  AlertCircle,
  UserPlus,
  UserMinus,
  Gift,
  MoreHorizontal,
  Pencil,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { CreateHiringRequestDialog } from "@/components/hiring/create-hiring-request-dialog";
import { EditHiringRequestDialog } from "@/components/hiring/edit-hiring-request-dialog";
import { HiringReviewDialog } from "@/components/hiring/hiring-review-dialog";
import { HiringRequestSheet } from "@/components/hiring/hiring-request-sheet";
import { SeparationRequestTab } from "@/components/hiring/separation-request-tab";
import { MilestoneGiftTab } from "@/components/hiring/milestone-gift-tab";
import { hiringService } from "@/lib/api/services/hiring.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useHiringActionStore } from "@/lib/store/hiring-action.store";
import { StoreMultiSelect } from "@/components/hiring/store-multi-select";
import { cn } from "@/lib/utils";
import type { StoreRequest } from "@/types/hiring.types";

const AVAILABILITY_LABELS: Record<string, string> = {
  weekday: "Weekday",
  weekends: "Weekends",
  open_availability: "Open Availability",
};

const MIN_INITIAL_SKELETON_MS = 300;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const variant =
    lower === "approved"
      ? "default"
      : lower === "rejected"
        ? "destructive"
        : "secondary";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

function StatusIndicator({ color }: { color: "green" | "red" | "none" }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        color === "green"
          ? "bg-green-500"
          : color === "red"
            ? "bg-red-500"
            : "bg-muted-foreground/30"
      }`}
    />
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {["ID", "Date of Request", "Desired Start", "Status", "Decision"].map(
              (h) => (
                <TableHead key={h}>{h}</TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 6 }).map((_, j) => (
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

export default function HiringRequestPage() {
  const [activeTab, setActiveTab] = useState("hiring");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<import("@/types/hiring.types").StoreRequest | null>(null);
  const { selectedStore } = useSelectedStoreStore();
  const { canAccessRoute, isSuperAdmin, overviewStores } = useAuthStore();
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;
  const canCreateHiringRequest = canAccessRoute({ service: "Hiring", method: "POST", path: "/v1/stores/*/hiring-requests", storeId: effectiveStoreId });
  // Not store-scoped: true means this user is a dedicated milestone-gift manager.
  // canAccessRoute returns true for superadmins too (bypass), so gate on !isSuperAdmin()
  // to keep superadmins in the full three-tab view.
  const isMilestoneGiftManager = !isSuperAdmin() && canAccessRoute({ service: "Hiring", method: "POST", path: "/v1/stores/*/milestone-gift-requests" });

  /* Edit dialog */
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editRequestId, setEditRequestId] = useState<number | null>(null);

  /* Hiring review dialog */
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewRequestId, setReviewRequestId] = useState<number | null>(null);
  const [reviewStoreNumber, setReviewStoreNumber] = useState<string>("");

  const [rows, setRows] = useState<StoreRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  const validStoreIds = useMemo(
    () => new Set((overviewStores ?? []).flatMap((s) => (s.storeId ? [s.storeId] : []))),
    [overviewStores],
  );

  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(() => {
    const valid = new Set((overviewStores ?? []).flatMap((s) => (s.storeId ? [s.storeId] : [])));
    const fallback = [...valid];
    try {
      const raw = localStorage.getItem("store-filter:hiring-request");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Only keep IDs that belong to this user's stores
          const clamped = (parsed as string[]).filter((id) => valid.has(id));
          if (clamped.length > 0) return clamped;
        }
      }
    } catch {}
    return fallback;
  });

  // Re-clamp when overviewStores changes (e.g. after a re-login or store re-assignment)
  useEffect(() => {
    if (validStoreIds.size === 0) return;
    setSelectedStoreIds((prev) => {
      const clamped = prev.filter((id) => validStoreIds.has(id));
      return clamped.length > 0 ? clamped : [...validStoreIds];
    });
  }, [validStoreIds]);

  function handleStoreApply(ids: string[]) {
    setSelectedStoreIds(ids);
    try { localStorage.setItem("store-filter:hiring-request", JSON.stringify(ids)); } catch {}
  }

  // ── Deep-link from a hiring/separation/milestone-gift notification ─────
  const pendingHiringAction = useHiringActionStore((s) => s.pendingHiringAction);
  const clearPendingHiringAction = useHiringActionStore((s) => s.clearPendingHiringAction);
  const [highlightedRequestId, setHighlightedRequestId] = useState<number | null>(null);
  const [pendingHighlightId, setPendingHighlightId] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  // Switch to the right tab whenever a pending action arrives. Only clears it
  // here if the current view can't show that tab at all (e.g. a milestone-gift
  // manager's single-tab view) — otherwise the owning tab consumes/clears it.
  useEffect(() => {
    if (!pendingHiringAction) return;
    if (isMilestoneGiftManager && pendingHiringAction.tab !== "milestone_gift") {
      clearPendingHiringAction();
      return;
    }
    setActiveTab(pendingHiringAction.tab);
  }, [pendingHiringAction, isMilestoneGiftManager, clearPendingHiringAction]);

  // Effect A: apply the store filter for the Hiring tab, stash the target id locally
  useEffect(() => {
    if (!pendingHiringAction || pendingHiringAction.tab !== "hiring") return;
    if (!validStoreIds.has(pendingHiringAction.storeNumber)) {
      clearPendingHiringAction();
      return;
    }
    handleStoreApply([pendingHiringAction.storeNumber]);
    setPendingHighlightId(pendingHiringAction.requestId);
    clearPendingHiringAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHiringAction, validStoreIds, clearPendingHiringAction]);

  const fetchData = useCallback(
    async (targetPage: number) => {
      const ids = selectedStoreIds;
      if (ids.length === 0) {
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
          ids,
          targetPage,
          controller.signal,
        );
        setRows(res.data.filter((r) => r.request_type === "hiring"));
        setTotalPages(res.last_page);
        setPage(res.current_page);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "CanceledError") return;
        setError(
          err instanceof Error ? err.message : "Failed to load hiring requests.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [selectedStoreIds],
  );

  useEffect(() => {
    if (activeTab !== "hiring") {
      return;
    }

    if (selectedStoreIds.length === 0) {
      abortRef.current?.abort();
      setRows([]);
      setError(null);
      setIsLoading(false);
      setIsInitialLoadComplete(true);
      setTotalPages(1);
      setPage(1);
      return;
    }

    let cancelled = false;

    const bootstrapHiringTab = async () => {
      setIsInitialLoadComplete(false);
      const startedAt = Date.now();

      await fetchData(1);

      const elapsed = Date.now() - startedAt;
      const remaining = MIN_INITIAL_SKELETON_MS - elapsed;
      if (remaining > 0) {
        await delay(remaining);
      }

      if (!cancelled) {
        setIsInitialLoadComplete(true);
      }
    };

    void bootstrapHiringTab();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [activeTab, fetchData]);

  // Effect B: once the (re-)filtered rows land, highlight the matching row for 1.5s
  useEffect(() => {
    if (pendingHighlightId === null || !isInitialLoadComplete || isLoading) return;
    const target = rows.find((r) => r.hiring_request?.id === pendingHighlightId);
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

  const hasStore = selectedStoreIds.length > 0;
  const shouldShowSkeleton = activeTab === "hiring" && !isInitialLoadComplete;
  const isEmpty =
    activeTab === "hiring" &&
    hasStore &&
    isInitialLoadComplete &&
    !isLoading &&
    !error &&
    rows.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manage Requests"
        description="Manage hiring and separation requests for your stores."
      />

      {isMilestoneGiftManager ? (
        /* ── Milestone-only view ── */
        <MilestoneGiftTab active={true} fullAccess={true} />
      ) : (
        <>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="hiring" className="gap-2">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Hiring Request</span>
            <span className="sm:hidden">Hiring</span>
          </TabsTrigger>
          <TabsTrigger value="separation" className="gap-2">
            <UserMinus className="h-4 w-4" />
            <span className="hidden sm:inline">Separation Request</span>
            <span className="sm:hidden">Separation</span>
          </TabsTrigger>
          <TabsTrigger value="milestone_gift" className="gap-2">
            <Gift className="h-4 w-4" />
            <span className="hidden sm:inline">Milestone Gift</span>
            <span className="sm:hidden">Gift</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Hiring Request Tab ── */}
        <TabsContent value="hiring" className="mt-4" tabIndex={-1}>
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
                  <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                </Button>
                {canCreateHiringRequest && (
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="me-2 h-4 w-4" />
                    <span className="hidden sm:inline">Create Hiring Request</span>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchData(page)}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Loading skeleton */}
            {shouldShowSkeleton && <TableSkeleton />}

            {/* Empty state */}
            {isEmpty && (
              <div className="rounded-lg border p-10 text-center text-muted-foreground text-sm">
                No hiring requests found.
              </div>
            )}

            {/* Table */}
            {isInitialLoadComplete && !error && rows.length > 0 && (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="hidden sm:table-cell">Date of Request</TableHead>
                      <TableHead className="hidden md:table-cell">Store #</TableHead>
                      <TableHead className="hidden md:table-cell">Desired Start</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Decision</TableHead>
                      {/* <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                      </TableHead> */}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((req) => (
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
                        <TableCell className="whitespace-nowrap hidden sm:table-cell">
                          {req.requested_at
                            ? new Date(req.requested_at).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs hidden md:table-cell">
                          {req.hiring_request?.store?.store_number ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap hidden md:table-cell">
                          {req.hiring_request?.desired_start_date
                            ? new Date(req.hiring_request.desired_start_date).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={req.workflow_status} />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {req.latest_decision ? (
                            <div className="text-sm">
                              <span className="capitalize font-medium">
                                {req.latest_decision.decision}
                              </span>
                              {req.latest_decision.number_hired != null && (
                                <span className="text-muted-foreground ms-1">
                                  ({req.latest_decision.number_hired} hired)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {/* <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditRequestId(req.id);
                                  setEditDialogOpen(true);
                                }}
                              >
                                <Pencil className="me-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReviewRequestId(req.id);
                                  setReviewStoreNumber(
                                    req.hiring_request?.store?.store_number ??
                                    (overviewStores?.find((s) => Number(s.id) === req.store_id)?.storeId ?? "")
                                  );
                                  setReviewDialogOpen(true);
                                }}
                              >
                                <ClipboardCheck className="me-2 h-4 w-4" />
                                Hiring Review
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell> */}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && isInitialLoadComplete && !error && rows.length > 0 && (
              <div className="flex items-center justify-end gap-2 text-sm">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchData(page - 1)}
                  disabled={page <= 1 || isLoading}
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
                  disabled={page >= totalPages || isLoading}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Separation Request Tab ── */}
        <TabsContent value="separation" className="mt-4" tabIndex={-1}>
          <SeparationRequestTab
            active={activeTab === "separation"}
          />
        </TabsContent>

        {/* ── Milestone Gift Tab ── */}
        <TabsContent value="milestone_gift" className="mt-4" tabIndex={-1}>
          <MilestoneGiftTab
            active={activeTab === "milestone_gift"}
            fullAccess={isSuperAdmin() || canAccessRoute({ service: "Hiring", method: "POST", path: "/v1/stores/*/milestone-gift-requests" })}
          />
        </TabsContent>
      </Tabs>

      {/* Hiring dialogs / sheets */}
      <CreateHiringRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => fetchData(1)}
      />

      <EditHiringRequestDialog
        requestId={editRequestId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => fetchData(page)}
      />

      <HiringReviewDialog
        requestId={reviewRequestId}
        storeId={reviewStoreNumber}
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        onSuccess={() => fetchData(page)}
      />

      <HiringRequestSheet
        request={selectedRequest}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={() => fetchData(page)}
      />

        </>
      )}

    </div>
  );
}
