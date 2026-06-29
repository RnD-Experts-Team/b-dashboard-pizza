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
  ClipboardCheck,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { CreateSeparationRequestDialog } from "@/components/hiring/create-separation-request-dialog";
import { EditSeparationRequestDialog } from "@/components/hiring/edit-separation-request-dialog";
import { SeparationRequestSheet } from "@/components/hiring/separation-request-sheet";
import { SeparationReviewDialog } from "@/components/hiring/separation-review-dialog";
import { hiringService } from "@/lib/api/services/hiring.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import { StoreMultiSelect } from "@/components/hiring/store-multi-select";
import type { StoreRequest } from "@/types/hiring.types";
import type {
  SeparationType,
} from "@/types/separation.types";

const SEPARATION_LABELS: Record<SeparationType, string> = {
  termination: "Termination",
  resignation: "Resignation",
};

function SeparationTypeBadge({ type }: { type: SeparationType }) {
  const variant =
    type === "termination"
      ? "destructive"
      : type === "resignation"
        ? "secondary"
        : "default";
  return (
    <Badge variant={variant} className="capitalize">
      {SEPARATION_LABELS[type] ?? type}
    </Badge>
  );
}

function WorkflowStatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const variant =
    lower === "completed"
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

function SepTableSkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {["Final Work Date",
              "Employee",
              "Separation Type",
              "Reason",
              "Status",
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
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

export function SeparationRequestTab({
  active = true,
}: {
  active?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<StoreRequest | null>(null);
  const { selectedStore } = useSelectedStoreStore();
  const { canAccessRoute, overviewStores } = useAuthStore();
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;
  const canCreateSeparationRequest = canAccessRoute({ service: "Hiring", method: "POST", path: "/v1/stores/*/separation-requests", storeId: effectiveStoreId });

  /* Edit dialog */
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editSeparationId, setEditSeparationId] = useState<number | null>(null);

  /* Separation review dialog */
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewSeparationId, setReviewSeparationId] = useState<number | null>(null);

  /* Store number resolved from the row, used for all action dialogs */
  const [actionStoreId, setActionStoreId] = useState<string>("");

  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(() => {
    const fallback = (overviewStores ?? []).flatMap((s) => s.storeId ? [s.storeId] : []);
    try {
      const raw = localStorage.getItem("store-filter:separation");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
      }
    } catch {}
    return fallback;
  });

  function handleStoreApply(ids: string[]) {
    setSelectedStoreIds(ids);
    try { localStorage.setItem("store-filter:separation", JSON.stringify(ids)); } catch {}
  }

  const [rows, setRows] = useState<StoreRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

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
          targetPage,
          controller.signal,
        );
        setRows(res.data.filter((r) => r.request_type === "separation"));
        setTotalPages(res.last_page);
        setPage(res.current_page);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "CanceledError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load separation requests.",
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

  const isEmpty = isInitialLoadComplete && !isLoading && !error && rows.length === 0;


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
          {canCreateSeparationRequest && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="me-2 h-4 w-4" />
              <span className="hidden sm:inline">Create Separation Request</span>
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
      {(!isInitialLoadComplete || isLoading) && <SepTableSkeleton />}

      {/* Empty state */}
      {isEmpty && (
        <div className="rounded-lg border p-10 text-center text-muted-foreground text-sm">
          No separation requests found.
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && rows.length > 0 && (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Final Work Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Separation Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((req) => {
                const sep = req.separation_request;
                const reason = sep?.resignation_reason ?? sep?.termination_reason ?? null;
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
                      {sep?.final_working_day
                        ? new Date(sep.final_working_day).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {sep?.employee
                        ? `${sep.employee.first_name} ${sep.employee.last_name}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {sep?.separation_type ? (
                        <SeparationTypeBadge type={sep.separation_type} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {reason ? (
                        <span className="capitalize text-sm">
                          {reason.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <WorkflowStatusBadge status={req.workflow_status} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
                          {/* <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditSeparationId(req.id);
                              setActionStoreId(req.separation_request?.store?.store_number ?? "");
                              setEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="me-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem> */}
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewSeparationId(req.id);
                              setActionStoreId(req.separation_request?.store?.store_number ?? "");
                              setReviewDialogOpen(true);
                            }}
                          >
                            <ClipboardCheck className="me-2 h-4 w-4" />
                            Separation Review
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

      <CreateSeparationRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => fetchData(1)}
      />

      <EditSeparationRequestDialog
        separationId={editSeparationId}
        storeId={actionStoreId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => fetchData(page)}
      />

      <SeparationRequestSheet
        request={selectedRequest}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={() => fetchData(page)}
      />

      <SeparationReviewDialog
        separationId={reviewSeparationId}
        storeId={actionStoreId}
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        onSuccess={() => fetchData(page)}
      />
    </div>
  );
}
