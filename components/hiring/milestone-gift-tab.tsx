"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import type { StoreRequest } from "@/types/hiring.types";
import type {
  Milestone,
  MilestoneGiftStage,
} from "@/types/milestone-gift.types";

const MILESTONE_LABELS: Record<Milestone, string> = {
  "30_days": "30 Days",
  "90_days": "90 Days",
  "6_months": "6 Months",
  "1_year": "1 Year",
  "2_years": "2 Years",
  other: "Other",
};

const STAGE_LABELS: Record<MilestoneGiftStage, string> = {
  created: "Created",
  rating: "Rating",
  gift_decision: "Gift Decision",
  final_status: "Final Status",
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
            {["Employee", "Milestone", "Stage", "Date of Request"].map((h) => (
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
}: {
  active?: boolean;
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

  const [rows, setRows] = useState<StoreRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (targetPage: number) => {
      if (!selectedStore?.storeId) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const res = await hiringService.getStoreRequests(
          selectedStore.storeId,
          targetPage,
          controller.signal,
        );
        setRows(res.data.filter((r) => r.request_type === "milestone_gift"));
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
    [selectedStore?.storeId],
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

  const isEmpty =
    isInitialLoadComplete && !isLoading && !error && rows.length === 0;

  const actionMg = actionRequest?.milestone_gift_request ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Actions row */}
      <div className="flex items-center justify-end gap-2">
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
        {canCreateMilestoneGift && (
          <Button variant="outline" onClick={() => setCatalogOpen(true)}>
            <ListChecks className="me-2 h-4 w-4" />
            <span className="hidden sm:inline">Manage Questions</span>
            <span className="sm:hidden">Questions</span>
          </Button>
        )}
        {canCreateMilestoneGift && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            <span className="hidden sm:inline">Create Milestone Gift</span>
            <span className="sm:hidden">New</span>
          </Button>
        )}
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

      {/* Loading skeleton */}
      {(!isInitialLoadComplete || isLoading) && <MgTableSkeleton />}

      {/* Empty state */}
      {isEmpty && (
        <div className="rounded-lg border p-10 text-center text-muted-foreground text-sm">
          No milestone gift requests found.
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && rows.length > 0 && (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Milestone</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Date of Request</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((req) => {
                const mg = req.milestone_gift_request;
                const employeeName = mg?.employee
                  ? `${mg.employee.first_name} ${mg.employee.last_name}`
                  : "—";
                const stage = mg?.stage;
                const isTerminal = stage === "closed" || stage === "cancelled";
                return (
                  <TableRow
                    key={req.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedRequest(req);
                      setSheetOpen(true);
                    }}
                  >
                    <TableCell className="whitespace-nowrap">
                      {employeeName}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionRequest(req);
                              setRatingDialogOpen(true);
                            }}
                          >
                            <ClipboardList className="me-2 h-4 w-4" />
                            Submit Rating
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionRequest(req);
                              setDecisionDialogOpen(true);
                            }}
                          >
                            <Gift className="me-2 h-4 w-4" />
                            Gift Decision
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionRequest(req);
                              setFinalStatusDialogOpen(true);
                            }}
                          >
                            <PackageCheck className="me-2 h-4 w-4" />
                            Final Status
                          </DropdownMenuItem>
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
        open={ratingDialogOpen}
        onOpenChange={setRatingDialogOpen}
        onSuccess={() => fetchData(page)}
      />

      <MilestoneGiftDecisionDialog
        requestId={actionMg?.id ?? null}
        decision={actionMg?.decision ?? null}
        open={decisionDialogOpen}
        onOpenChange={setDecisionDialogOpen}
        onSuccess={() => fetchData(page)}
      />

      <MilestoneGiftFinalStatusDialog
        requestId={actionMg?.id ?? null}
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
        storeId={effectiveStoreId}
        storeName={selectedStore?.name}
      />
    </div>
  );
}
