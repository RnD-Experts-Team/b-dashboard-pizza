"use client";

import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { qaService, QAError } from "@/lib/api/services/qa.service";
import type { CustomReport, CustomReportPayload } from "@/types/qa.types";
import {
  useCustomReports,
  useCreateCustomReport,
  useUpdateCustomReport,
  useDeleteCustomReport,
  useCustomReportDetail,
} from "@/lib/hooks/use-custom-reports";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  RefreshCw,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Calendar,
  Hash,
  FileText,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { QAEntityWithCategory } from "@/types/qa.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function isCanceledError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "CanceledError") return true;
  return false;
}

function formatDate(value: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Entity Multi-Select                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function EntityMultiSelect({
  entities,
  selectedIds,
  onSelectedChange,
  isLoading,
  error,
}: {
  entities: QAEntityWithCategory[];
  selectedIds: number[];
  onSelectedChange: (ids: number[]) => void;
  isLoading: boolean;
  error?: string;
}) {
  const t = useTranslations("customReports");

  const toggleEntity = (id: number) => {
    if (selectedIds.includes(id)) {
      onSelectedChange(selectedIds.filter((eid) => eid !== id));
    } else {
      onSelectedChange([...selectedIds, id]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("form.loadingEntities")}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (entities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("form.noEntities")}</p>
    );
  }

  return (
    <ScrollArea className="h-48 rounded-md border p-2">
      <div className="space-y-1">
        {entities.map((entity) => (
          <label
            key={entity.id}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent transition-colors",
              selectedIds.includes(entity.id) && "bg-accent"
            )}
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(entity.id)}
              onChange={() => toggleEntity(entity.id)}
              className="h-4 w-4 rounded border-input"
            />
            <span className="truncate">{entity.entityLabel}</span>
            {entity.categoryLabel && (
              <Badge variant="outline" className="ms-auto text-xs shrink-0">
                {entity.categoryLabel}
              </Badge>
            )}
          </label>
        ))}
      </div>
    </ScrollArea>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Create / Edit Dialog                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

interface ReportFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  report?: CustomReport | null;
}

function ReportFormDialog({
  open,
  onOpenChange,
  onSuccess,
  report,
}: ReportFormDialogProps) {
  const t = useTranslations("customReports");
  const isEdit = !!report;

  const [name, setName] = useState(report?.name ?? "");
  const [entityIds, setEntityIds] = useState<number[]>(report?.entityIds ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Entities for the multi-select
  const [entities, setEntities] = useState<QAEntityWithCategory[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [entitiesError, setEntitiesError] = useState<string | undefined>();

  const { createReport } = useCreateCustomReport();
  const { updateReport } = useUpdateCustomReport();

  // Load entities when dialog opens
  const loadEntities = useCallback(async (signal?: AbortSignal) => {
    setEntitiesLoading(true);
    setEntitiesError(undefined);
    try {
      const result = await qaService.getEntitiesForCustomReports(signal);
      if (signal?.aborted) return;
      setEntities(result);
    } catch (err) {
      if (isCanceledError(err) || signal?.aborted) return;
      setEntitiesError(
        err instanceof Error ? err.message : "Failed to load entities."
      );
    } finally {
      if (!signal?.aborted) setEntitiesLoading(false);
    }
  }, []);

  // Always load entities when the dialog opens (works for both
  // parent-controlled open and internal open changes).
  useEffect(() => {
    if (!open) return;

    setName(report?.name ?? "");
    setEntityIds(report?.entityIds ?? []);
    setValidationErrors({});

    const controller = new AbortController();
    loadEntities(controller.signal);

    return () => controller.abort();
  }, [open, report, loadEntities]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = t("form.validation.nameRequired");
    } else if (name.length > 255) {
      errors.name = t("form.validation.nameMaxLength");
    }
    if (entityIds.length === 0) {
      errors.entityIds = t("form.validation.entitiesRequired");
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const payload: CustomReportPayload = {
        name: name.trim(),
        entity_ids: entityIds,
      };
      if (isEdit && report) {
        await updateReport(report.id, payload);
        toast.success(t("form.updateSuccess"));
      } else {
        await createReport(payload);
        toast.success(t("form.createSuccess"));
      }
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      if (isCanceledError(err)) return;
      const message =
        err instanceof QAError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("form.error");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("form.editTitle") : t("form.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t("form.editDescription") : t("form.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="report-name">
              {t("form.name")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="report-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationErrors.name) {
                  setValidationErrors((prev) => {
                    const next = { ...prev };
                    delete next.name;
                    return next;
                  });
                }
              }}
              placeholder={t("form.namePlaceholder")}
              maxLength={255}
              className={cn(validationErrors.name && "border-destructive")}
            />
            {validationErrors.name && (
              <p className="text-xs text-destructive">{validationErrors.name}</p>
            )}
          </div>

          {/* Entity IDs multi-select */}
          <div className="grid gap-2">
            <Label>
              {t("form.entities")} <span className="text-destructive">*</span>
            </Label>
            <EntityMultiSelect
              entities={entities}
              selectedIds={entityIds}
              onSelectedChange={(ids) => {
                setEntityIds(ids);
                if (validationErrors.entityIds) {
                  setValidationErrors((prev) => {
                    const next = { ...prev };
                    delete next.entityIds;
                    return next;
                  });
                }
              }}
              isLoading={entitiesLoading}
              error={entitiesError}
            />
            {entityIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("form.selectedCount", { count: entityIds.length })}
              </p>
            )}
            {validationErrors.entityIds && (
              <p className="text-xs text-destructive">
                {validationErrors.entityIds}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {t("form.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {isSaving
              ? t("form.saving")
              : isEdit
                ? t("form.save")
                : t("form.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Delete Confirmation Dialog                                              */
/* ────────────────────────────────────────────────────────────────────────── */

interface DeleteDialogProps {
  report: CustomReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function DeleteReportDialog({
  report,
  open,
  onOpenChange,
  onSuccess,
}: DeleteDialogProps) {
  const t = useTranslations("customReports");
  const { deleteReport, isDeleting } = useDeleteCustomReport();

  const handleDelete = async () => {
    try {
      await deleteReport(report.id);
      toast.success(t("delete.success"));
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      if (isCanceledError(err)) return;
      const message =
        err instanceof QAError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("delete.error");
      toast.error(message);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("delete.description", { name: report.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {t("delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {isDeleting ? t("delete.deleting") : t("delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Row Actions                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

interface RowActionsProps {
  report: CustomReport;
  onSuccess: () => void;
}

function RowActions({ report, onSuccess }: RowActionsProps) {
  const t = useTranslations("customReports");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div data-no-row-click="true" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={t("actions.openMenu")}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="me-2 h-4 w-4" />
            {t("actions.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="me-2 h-4 w-4" />
            {t("actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={onSuccess}
        report={report}
      />

      <DeleteReportDialog
        report={report}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={onSuccess}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Detail Sheet                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

interface DetailSheetProps {
  reportId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ReportDetailSheet({ reportId, open, onOpenChange }: DetailSheetProps) {
  const t = useTranslations("customReports");
  const activeId = open ? reportId : null;
  const { report, isLoading, error, refetch } = useCustomReportDetail(activeId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full p-0 sm:max-w-xl md:max-w-2xl">
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <SheetTitle>{t("detail.title")}</SheetTitle>
          <SheetDescription>
            {report
              ? `${report.name} (#${report.id})`
              : reportId
                ? `${t("detail.report")} #${reportId}`
                : t("detail.title")}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("detail.loading")}
          </div>
        ) : error ? (
          <div className="space-y-3 p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch} className="w-fit">
              <RefreshCw className="me-2 h-4 w-4" />
              {t("detail.retry")}
            </Button>
          </div>
        ) : report ? (
          <>
            {/* Report metadata */}
            <div className="grid grid-cols-1 gap-3 px-4 pt-4 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="font-medium text-foreground">
                  {report.name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Hash className="h-4 w-4 shrink-0" />
                <span>
                  ID: <span className="font-medium text-foreground">{report.id}</span>
                </span>
              </div>
              {report.createdAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>{t("detail.created")}: {formatDate(report.createdAt)}</span>
                </div>
              )}
              {report.updatedAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>{t("detail.updated")}: {formatDate(report.updatedAt)}</span>
                </div>
              )}
            </div>

            <Separator className="my-3" />

            {/* Entities */}
            <ScrollArea className="h-[calc(100vh-18rem)] px-4 pb-6">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Layers className="inline h-3.5 w-3.5 me-1" />
                {t("detail.entities")} ({report.entities?.length ?? report.entitiesCount ?? report.entityIds.length})
              </h4>

              {report.entities && report.entities.length > 0 ? (
                <div className="space-y-2">
                  {report.entities.map((entity) => (
                    <article
                      key={entity.id}
                      className="rounded-lg border p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {entity.entityLabel}
                        </span>
                        <Badge variant={entity.active ? "default" : "secondary"}>
                          {entity.active ? t("detail.active") : t("detail.inactive")}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>ID: {entity.id}</span>
                        <span>·</span>
                        <span>{entity.dateRangeType}</span>
                        {entity.reportType && (
                          <>
                            <span>·</span>
                            <span>{entity.reportType}</span>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : report.entityIds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {report.entityIds.map((eid) => (
                    <Badge key={eid} variant="outline">
                      Entity #{eid}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("detail.noEntities")}
                </p>
              )}
            </ScrollArea>
          </>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {t("detail.noData")}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main Page Export                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export default function CustomReportsPage() {
  const t = useTranslations("customReports");
  const { reports, isLoading, error, refetch } = useCustomReports();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refetch();
    // Give a brief visual indication
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRowClick = (report: CustomReport) => {
    setDetailId(report.id);
    setDetailOpen(true);
  };

  const columns = [
    {
      key: "id",
      header: t("table.id"),
      className: "w-16",
      cell: (r: CustomReport) => (
        <span className="font-mono text-xs">{r.id}</span>
      ),
    },
    {
      key: "name",
      header: t("table.name"),
      cell: (r: CustomReport) => (
        <span className="font-medium">{r.name}</span>
      ),
    },
    {
      key: "entityIds",
      header: t("table.entities"),
      cell: (r: CustomReport) => {
        const count = r.entitiesCount ?? r.entityIds.length;
        return (
          <Badge variant="secondary">
            {count} {count === 1 ? t("table.entity") : t("table.entitiesLabel")}
          </Badge>
        );
      },
    },
    {
      key: "createdAt",
      header: t("table.createdAt"),
      className: "hidden sm:table-cell",
      cell: (r: CustomReport) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(r.createdAt)}
        </span>
      ),
    },
    {
      key: "updatedAt",
      header: t("table.updatedAt"),
      className: "hidden md:table-cell",
      cell: (r: CustomReport) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(r.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      cell: (r: CustomReport) => <RowActions report={r} onSuccess={refetch} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
          >
            <RefreshCw
              className={cn(
                "me-2 h-4 w-4",
                (isLoading || isRefreshing) && "animate-spin"
              )}
            />
            {isRefreshing ? t("refreshing") : t("refresh")}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("createReport")}
          </Button>
        </div>
      </PageHeader>

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="me-2 h-4 w-4" />
            {t("retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          data={reports}
          columns={columns}
          isLoading={isLoading}
          searchable
          searchPlaceholder={t("searchPlaceholder")}
          emptyMessage={t("emptyMessage")}
          onRowClick={handleRowClick}
          getRowKey={(r) => r.id}
        />
      )}

      {/* Create dialog */}
      <ReportFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={refetch}
      />

      {/* Detail sheet */}
      <ReportDetailSheet
        reportId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
