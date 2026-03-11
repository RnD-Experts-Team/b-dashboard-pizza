"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import type { CameraFormsListResponse } from "@/types/qa.types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { CameraFormDetailsSheet } from "@/components/qa/camera-form-details-sheet";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building2,
  User,
  Calendar,
  Camera,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import type { CameraFormAudit } from "@/types/qa.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Rating color helper                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function getRatingVariant(
  label: string
): "default" | "secondary" | "destructive" | "outline" {
  const l = label.toLowerCase();
  if (l === "pass") return "default";
  if (l === "fail" || l === "auto fail" || l === "autofail") return "destructive";
  if (l === "urgent") return "destructive";
  return "secondary";
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Unique entities extractor                                               */
/* ────────────────────────────────────────────────────────────────────────── */

interface UniqueEntity {
  id: number;
  label: string;
  category: string;
}

function extractUniqueEntities(audits: CameraFormAudit[]): UniqueEntity[] {
  const entityMap = new Map<number, UniqueEntity>();

  for (const audit of audits) {
    for (const entry of audit.cameraForms) {
      if (!entityMap.has(entry.entity.id)) {
        entityMap.set(entry.entity.id, {
          id: entry.entity.id,
          label: entry.entity.entityLabel,
          category: entry.entity.category.label,
        });
      }
    }
  }

  // Sort by category then by label
  return Array.from(entityMap.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.label.localeCompare(b.label);
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Table Component                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

interface CameraFormsListTableProps {
  data: CameraFormsListResponse;
  isRefreshing: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  label: string;
  onDelete?: (id: number) => Promise<void>;
  isDeleting?: boolean;
}

export function CameraFormsListTable({
  data,
  isRefreshing,
  currentPage,
  onPageChange,
  label,
  onDelete,
  isDeleting,
}: CameraFormsListTableProps) {
  const { pagination } = data;
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";
  const { canAccessRoute, overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [auditToDelete, setAuditToDelete] = useState<CameraFormAudit | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(null);

  // Keep store resolution aligned with sidebar/page-level authorization checks.
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;
  const deleteRequirements = [
    {
      service: "QA",
      method: "DELETE",
      path: "/camera-forms/id",
      storeId: effectiveStoreId,
    },
  ];
  const editRequirements = [
    {
      service: "QA",
      method: "PUT",
      path: "/camera-forms/id",
      storeId: effectiveStoreId,
    },
  ];
  const canDeleteCameraForm = deleteRequirements.some((requirement) =>
    canAccessRoute(requirement)
  );
  const canEditCameraForm = editRequirements.some((requirement) =>
    canAccessRoute(requirement)
  );
  const canManageCameraForms = canEditCameraForm || canDeleteCameraForm;

  const handleRowOpen = (auditId: number) => {
    setSelectedAuditId(auditId);
    setDetailsOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, audit: CameraFormAudit) => {
    e.stopPropagation();
    if (!canDeleteCameraForm) return;
    setAuditToDelete(audit);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (auditToDelete && onDelete) {
      try {
        await onDelete(auditToDelete.id);
      } catch {
        // Error handled by store
      }
    }
    setDeleteDialogOpen(false);
    setAuditToDelete(null);
  };

  const handleEditClick = (e: React.MouseEvent, audit: CameraFormAudit) => {
    e.stopPropagation();
    if (!canEditCameraForm) return;
    router.push(`/${locale}/dashboard/quality-assurance/${audit.id}`);
  };

  const renderAuditActions = (audit: CameraFormAudit) => {
    if (!canManageCameraForms) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEditCameraForm && (
            <DropdownMenuItem onClick={(e) => handleEditClick(e, audit)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          )}
          {canEditCameraForm && canDeleteCameraForm && <DropdownMenuSeparator />}
          {canDeleteCameraForm && (
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => handleDeleteClick(e, audit)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Extract all unique entities across all audits
  const uniqueEntities = useMemo(
    () => extractUniqueEntities(data.audits),
    [data.audits]
  );

  // Helper to get rating for an audit+entity combination
  const getRating = (audit: CameraFormAudit, entityId: number): string => {
    const entry = audit.cameraForms.find((e) => e.entityId === entityId);
    return entry ? entry.rating.label : "-";
  };

  // Format ISO timestamp as a date in UTC (avoid local timezone shifts)
  const formatDateUTC = (iso: string) => {
    try {
      const d = parseISO(iso);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const dd = d.getUTCDate();
      return format(new Date(y, m, dd), "MMM dd, yyyy");
    } catch (e) {
      return iso;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {label}
            </CardTitle>
            <CardDescription>
              {pagination.from && pagination.to
                ? `Showing ${pagination.from}-${pagination.to} of ${pagination.total} form(s)`
                : `${pagination.total} form(s) total`}
            </CardDescription>
          </div>
          {isRefreshing && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Refreshing...
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {data.audits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No camera forms found.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    {/* <TableHead>Auditor</TableHead> */}
                    <TableHead>Date</TableHead>
                    {uniqueEntities.map((entity) => (
                      <TableHead key={entity.id} className="text-center min-w-25">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold">
                            {entity.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {entity.category}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="w-12.5"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.audits.map((audit) => (
                    <TableRow
                      key={audit.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors",
                        isRefreshing && "opacity-60"
                      )}
                      tabIndex={0}
                      role="button"
                      onClick={() => handleRowOpen(audit.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleRowOpen(audit.id);
                        }
                      }}
                    >
                        <TableCell>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">
                              {audit.store.store}
                            </span>
                          </div>
                        </TableCell>
                        {/* <TableCell>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-sm">{audit.user.id}</span>
                              <span className="text-xs text-muted-foreground">
                                {audit.user.email}
                              </span>
                            </div>
                          </div>
                        </TableCell> */}
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDateUTC(audit.date)} 
                          </div>
                        </TableCell>
                        {uniqueEntities.map((entity) => {
                          const rating = getRating(audit, entity.id);
                          return (
                            <TableCell key={entity.id} className="text-center">
                              {rating === "-" ? (
                                <span className="text-muted-foreground">-</span>
                              ) : (
                                <Badge
                                  variant={getRatingVariant(rating)}
                                  className="text-xs whitespace-nowrap"
                                >
                                  {rating}
                                </Badge>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {renderAuditActions(audit)}
                        </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {data.audits.map((audit) => (
                <div
                  key={audit.id}
                  className={cn(
                    "cursor-pointer rounded-lg border p-4 space-y-3 hover:bg-muted/50 transition-colors",
                    isRefreshing && "opacity-60"
                  )}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRowOpen(audit.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleRowOpen(audit.id);
                    }
                  }}
                >
                  {/* Header with actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">
                        {audit.store.store}
                      </span>
                    </div>
                    {renderAuditActions(audit)}
                  </div>

                    {/* Meta info */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span>{audit.user.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDateUTC(audit.date)}</span>
                      </div>
                    </div>

                    {/* Entity ratings grid */}
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Entity Ratings
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {uniqueEntities.map((entity) => {
                          const rating = getRating(audit, entity.id);
                          return (
                            <div
                              key={entity.id}
                              className="flex flex-col gap-1 p-2 rounded bg-muted/30"
                            >
                              <span className="text-xs font-medium truncate">
                                {entity.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {entity.category}
                              </span>
                              {rating === "-" ? (
                                <span className="text-xs text-muted-foreground">
                                  -
                                </span>
                              ) : (
                                <Badge
                                  variant={getRatingVariant(rating)}
                                  className="text-xs w-fit"
                                >
                                  {rating}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
              ))}
            </div>
          </>
        )}
      </CardContent>

      {/* Pagination controls */}
      {pagination.lastPage > 1 && (
        <div className="flex items-center justify-between border-t px-6 py-4">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {pagination.lastPage}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(1)}
              disabled={!data.hasPrevPage || isRefreshing}
              aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!data.hasPrevPage || isRefreshing}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!data.hasNextPage || isRefreshing}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(pagination.lastPage)}
              disabled={!data.hasNextPage || isRefreshing}
              aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Camera Form</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete camera form #{auditToDelete?.id}
              {auditToDelete?.store?.store ? ` for ${auditToDelete.store.store}` : ""}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CameraFormDetailsSheet
        auditId={selectedAuditId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </Card>
  );
}
