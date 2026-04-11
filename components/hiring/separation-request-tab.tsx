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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  RefreshCw,
  AlertCircle,
  MoreHorizontal,
  Trash2,
  ClipboardCheck,
  Download,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { CreateSeparationRequestDialog } from "@/components/hiring/create-separation-request-dialog";
import { EditSeparationRequestDialog } from "@/components/hiring/edit-separation-request-dialog";
import { SeparationRequestSheet } from "@/components/hiring/separation-request-sheet";
import { SeparationReviewDialog } from "@/components/hiring/separation-review-dialog";
import { separationService } from "@/lib/api/services/separation.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type {
  SeparationRequestRecord,
  SeparationReasonType,
  SeparationType,
} from "@/types/separation.types";

const REASON_LABELS: Record<SeparationReasonType, string> = {
  other: "Other",
  resignation: "Resignation",
  termination: "Termination",
};

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

function ReasonBadge({ reason }: { reason?: SeparationReasonType }) {
  if (!reason) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Badge variant="outline" className="capitalize">
      {REASON_LABELS[reason] ?? reason}
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

function SepTableSkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Final Work Date",              "Employee",              "Separation Type",
              "Reason",
              "Reason Title",
              "Supervisor",
              "Review",
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 8 }).map((_, j) => (
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
  showExportButton = false,
}: {
  active?: boolean;
  showExportButton?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedSeparationId, setSelectedSeparationId] = useState<number | null>(null);
  const { selectedStore } = useSelectedStoreStore();

  /* Delete confirmation */
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteRequestId, setDeleteRequestId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  /* Edit dialog */
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editSeparationId, setEditSeparationId] = useState<number | null>(null);

  /* Separation review dialog */
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewSeparationId, setReviewSeparationId] = useState<number | null>(null);

  const [rows, setRows] = useState<SeparationRequestRecord[]>([]);
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
        const res = await separationService.getSeparationRequests(
          selectedStore.storeId,
          targetPage,
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
            : "Failed to load separation requests.",
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

  const isEmpty = isInitialLoadComplete && !isLoading && !error && rows.length === 0;

  async function handleDelete() {
    if (deleteRequestId === null || !selectedStore?.storeId) return;
    setIsDeleting(true);
    try {
      await separationService.deleteSeparationRequest(selectedStore.storeId, deleteRequestId);
      toast.success("Separation request deleted.");
      setDeleteConfirmOpen(false);
      setDeleteRequestId(null);
      fetchData(page);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete separation request.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleExportSeparations() {
    if (!selectedStore?.storeId) {
      toast.error("Select a store before exporting separations.");
      return;
    }

    setIsExporting(true);
    try {
      await separationService.exportSeparations(selectedStore.storeId);
      toast.success("Separations export started.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to export separations.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Actions row */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchData(page)}
          disabled={isLoading || isExporting}
          aria-label="Refresh"
        >
          <RefreshCw
            className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
          />
        </Button>
        {showExportButton && (
          <Button
            variant="outline"
            onClick={handleExportSeparations}
            disabled={!selectedStore?.storeId || isLoading || isExporting}
          >
            <Download className="me-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        )}
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          <span className="hidden sm:inline">Create Separation Request</span>
          <span className="sm:hidden">New</span>
        </Button>
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
                <TableHead className="hidden md:table-cell">
                  Reason Title
                </TableHead>
                <TableHead className="text-center">Supervisor</TableHead>
                <TableHead className="text-center">Review</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((req) => (
                <TableRow
                  key={req.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSelectedSeparationId(req.id);
                    setSheetOpen(true);
                  }}
                >
                  {(() => {
                    const profile = req.employee?.employee_profile ?? req.employee_profile;
                    const employeeName = profile
                      ? [profile.first_name, profile.middle_name, profile.last_name]
                          .filter(Boolean)
                          .join(" ")
                      : "—";
                    const derivedReason =
                      req.reason_type ?? req.separation_attachments?.find((a) => a.reason)?.reason?.reason_type;
                    const derivedReasonTitle =
                      req.reason_title ?? req.separation_attachments?.find((a) => a.reason)?.reason?.reason_title;

                    return (
                      <>
                  <TableCell className="whitespace-nowrap">
                    {req.final_work_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {employeeName}
                  </TableCell>
                  <TableCell>
                    <SeparationTypeBadge type={req.separation_type} />
                  </TableCell>
                  <TableCell>
                    <ReasonBadge reason={derivedReason} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-50 truncate">
                    {derivedReasonTitle ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusIndicator
                      color={
                        req.supervisor_approve === null || req.supervisor_approve === undefined
                          ? "none"
                          : req.supervisor_approve.accept_status
                            ? "green"
                            : "red"
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusIndicator
                      color={
                        req.hiring_review === null || req.hiring_review === undefined
                          ? "none"
                          : req.hiring_review.is_completed
                            ? "green"
                            : "red"
                      }
                    />
                  </TableCell>
                  <TableCell>
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
                            setEditSeparationId(req.id);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="me-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={req.supervisor_approve === null || req.supervisor_approve === undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            setReviewSeparationId(req.id);
                            setReviewDialogOpen(true);
                          }}
                        >
                          <ClipboardCheck className="me-2 h-4 w-4" />
                          Separation Review
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteRequestId(req.id);
                            setDeleteConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="me-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                      </>
                    );
                  })()}
                </TableRow>
              ))}
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
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => fetchData(page)}
      />

      <SeparationRequestSheet
        separationId={selectedSeparationId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={() => fetchData(page)}
      />

      <SeparationReviewDialog
        separationId={reviewSeparationId}
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        onSuccess={() => fetchData(page)}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Separation Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this separation request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
