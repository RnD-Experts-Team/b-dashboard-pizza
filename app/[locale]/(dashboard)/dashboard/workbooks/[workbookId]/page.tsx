"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  ChevronRight,
  Columns3,
  Home,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Rows3,
  SearchX,
  Shield,
  Table2,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/page-header";
import {
  AccessNote,
  ColumnEditorDialog,
  ConfirmDeleteDialog,
  GridFilters,
  GridPagination,
  GridSkeleton,
  GuardedButton,
  MenuRow,
  RowFormDialog,
  VisibilityChip,
  VisibilityDialog,
  WorkbookFormDialog,
  WorkbookGrid,
  WorkbooksDemoBanner,
  WorkbooksEmptyState,
  WorkbooksErrorCard,
  WorkbooksNoAccess,
  useDenyReason,
} from "@/components/workbooks";
import { workbooksService } from "@/lib/api/services/workbooks.service";
import { useAuth } from "@/lib/auth/use-auth";
import { useWorkbookGrid } from "@/lib/hooks/use-workbook-grid";
import { useWorkbookOptions } from "@/lib/hooks/use-workbook-options";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useWorkbooksStore } from "@/lib/store/workbooks.store";
import {
  EMPTY_ROWS_QUERY,
  rowsQueryFromParams,
  rowsQueryToParams,
} from "@/lib/workbooks/grid-url";
import type {
  Breadcrumb,
  RowsQuery,
  WorkbookFolder,
  WorkbookRow,
} from "@/types/workbooks.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  One workbook — the grid.                                                 */
/*                                                                            */
/*  The whole query (search, per-column filters, sort, page, page size)      */
/*  lives in the URL, so a filtered view can be reloaded or shared. Every    */
/*  control renders from `viewer.can`; a blocked one stays visible, goes     */
/*  disabled, and says why (effective_visibility.capped_by).                  */
/* ────────────────────────────────────────────────────────────────────────── */

export default function WorkbookPage() {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <WorkbookGate />
    </Suspense>
  );
}

function WorkbookGate() {
  const t = useTranslations("workbooks");
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin()) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <WorkbooksNoAccess />
      </div>
    );
  }
  return <WorkbookScreen />;
}

type Pending =
  | { kind: "addRow" }
  | { kind: "editRow"; row: WorkbookRow }
  | { kind: "retagRow"; row: WorkbookRow }
  | { kind: "deleteRow"; row: WorkbookRow }
  | { kind: "columns" }
  | { kind: "editWorkbook" }
  | { kind: "retagWorkbook" }
  | { kind: "deleteWorkbook" }
  | null;

function WorkbookScreen() {
  const t = useTranslations("workbooks");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const workbookId = Number(params?.workbookId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const query = useMemo(
    () => rowsQueryFromParams(new URLSearchParams(qs)),
    [qs],
  );
  const denyReason = useDenyReason();
  const { demo } = useWorkbookOptions();

  const selectedStoreName = useSelectedStoreStore(
    (s) => s.selectedStore?.name ?? null,
  );
  const knownFolders = useWorkbooksStore((s) => s.children);
  const grid = useWorkbookGrid(workbookId, query);
  const { workbook, columns, rows } = grid;
  const [pending, setPending] = useState<Pending>(null);

  const setQuery = useCallback(
    (patch: Partial<RowsQuery>) => {
      const next = rowsQueryToParams({ ...query, ...patch }).toString();
      router.replace(next ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    },
    [query, pathname, router],
  );

  const folderHref = (id: number) =>
    `/${locale}/dashboard/workbooks?folder=${id}`;

  const crumbs: Breadcrumb[] = useMemo(() => {
    if (!workbook) return [];
    return [...workbook.breadcrumb, { id: workbook.id, name: workbook.name }];
  }, [workbook]);

  /** The containing folder's tag, if the browser already loaded it. */
  const parentFolder: WorkbookFolder | null = useMemo(() => {
    if (!workbook) return null;
    for (const list of Object.values(knownFolders)) {
      const hit = list.find((f) => f.id === workbook.folderId);
      if (hit) return hit;
    }
    return null;
  }, [workbook, knownFolders]);

  if (!Number.isFinite(workbookId)) {
    return (
      <WorkbooksErrorCard
        error={{
          message: "",
          code: "NOT_FOUND",
          serverCode: null,
          retryable: false,
          cappedBy: null,
        }}
        showBack
      />
    );
  }

  /* ── The workbook itself failed: 404 = "not found, or no access". ── */
  if (grid.workbookError && !workbook) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} />
        <WorkbooksErrorCard
          error={grid.workbookError}
          onRetry={() => void grid.refetch()}
          showBack
        />
      </div>
    );
  }

  if (!workbook) return <GridSkeleton />;

  const can = workbook.can;
  const eff = workbook.effective;
  const noStore = grid.storeCode ? null : t("contents.needStore");
  const addRowReason = noStore ?? denyReason(can.addRows, eff, crumbs);
  const columnsReason = denyReason(can.manageColumns, eff, crumbs);
  const reorderReason = !can.edit
    ? denyReason(false, eff, crumbs)
    : !grid.manualOrder
      ? t("grid.reorderDisabled")
      : null;
  const refreshing =
    grid.rowsRefreshing || (grid.workbookLoading && Boolean(workbook));
  const hasRows = (rows?.items.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb, title and meta read as one block: their own rhythm
          (space-y-3), not the page's space-y-6 and no negative margins. */}
      <div className="space-y-3">
        <nav
          aria-label={t("grid.breadcrumb")}
          className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
        >
          <Link
            href={`/${locale}/dashboard/workbooks`}
            className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-foreground"
          >
            <Home className="h-3 w-3" />
            {t("title")}
          </Link>
          {workbook.breadcrumb.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3 w-3 rtl:rotate-180" />
              <Link
                href={folderHref(b.id)}
                className="max-w-40 truncate rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-foreground"
              >
                {b.name}
              </Link>
            </span>
          ))}
        </nav>

        <PageHeader
          title={workbook.name}
          description={workbook.description ?? undefined}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void grid.refetch()}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("me-2 h-4 w-4", refreshing && "animate-spin")}
              />
              {t("refresh")}
            </Button>
            <GuardedButton
              variant="outline"
              size="sm"
              reason={columnsReason}
              onClick={() => setPending({ kind: "columns" })}
            >
              <Columns3 className="me-2 h-4 w-4" />
              {t("grid.editColumns")}
            </GuardedButton>
            <GuardedButton
              size="sm"
              reason={addRowReason}
              onClick={() => setPending({ kind: "addRow" })}
            >
              <Plus className="me-2 h-4 w-4" />
              {t("grid.addRow")}
            </GuardedButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("contents.actions")}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <MenuRow
                  icon={Pencil}
                  label={t("grid.editDetails")}
                  reason={denyReason(can.edit, eff, crumbs)}
                  onSelect={() => setPending({ kind: "editWorkbook" })}
                />
                <MenuRow
                  icon={Shield}
                  label={t("contents.access")}
                  reason={denyReason(can.changeVisibility, eff, crumbs)}
                  onSelect={() => setPending({ kind: "retagWorkbook" })}
                />
                <DropdownMenuSeparator />
                <MenuRow
                  icon={Trash2}
                  label={t("grid.deleteWorkbook")}
                  destructive
                  reason={denyReason(can.delete, eff, crumbs)}
                  onSelect={() => setPending({ kind: "deleteWorkbook" })}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </PageHeader>

        {/* Meta strip: tag, owner, row count */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <VisibilityChip
            value={workbook.visibility}
            label={workbook.visibilityLabel}
            roles={workbook.visibilityRoles}
            size="md"
          />
          {rows && (
            <span className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 tabular-nums">
              <Rows3 className="h-3 w-3" />
              {t("grid.rowsCount", { count: rows.total })}
            </span>
          )}
          {workbook.createdBy && (
            <span>{t("contents.by", { name: workbook.createdBy.name })}</span>
          )}
          {workbook.store && (
            <span>· {workbook.store.name || workbook.store.storeNumber}</span>
          )}
        </div>
      </div>

      {demo && <WorkbooksDemoBanner />}

      {!can.edit && (
        <AccessNote capped={eff?.cappedBy} breadcrumb={crumbs} readOnly />
      )}

      {columns.length === 0 ? (
        <WorkbooksEmptyState
          icon={Columns3}
          title={t("grid.noColumns")}
          action={
            <GuardedButton
              size="sm"
              reason={columnsReason}
              onClick={() => setPending({ kind: "columns" })}
            >
              {t("grid.editColumns")}
            </GuardedButton>
          }
        />
      ) : (
        <div className="space-y-3">
          <GridFilters
            columns={columns}
            query={query}
            onChange={setQuery}
            onClearAll={() =>
              setQuery({
                ...EMPTY_ROWS_QUERY,
                perPage: query.perPage,
                sortColumn: query.sortColumn,
                sortOrder: query.sortOrder,
              })
            }
          />

          {grid.rowsError && !rows ? (
            <WorkbooksErrorCard
              error={grid.rowsError}
              onRetry={() => void grid.fetchRows()}
            />
          ) : grid.rowsLoading && !rows ? (
            <GridSkeleton />
          ) : !hasRows ? (
            grid.filterCount > 0 ? (
              <WorkbooksEmptyState
                icon={SearchX}
                title={t("grid.empty.filteredTitle")}
                body={t("grid.empty.filteredBody")}
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setQuery({ search: "", filters: {}, page: 1 })
                    }
                  >
                    {t("grid.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <WorkbooksEmptyState
                icon={Table2}
                title={t("grid.empty.title")}
                body={
                  can.addRows ? t("grid.empty.body") : t("grid.empty.readOnly")
                }
                action={
                  can.addRows ? (
                    <GuardedButton
                      size="sm"
                      reason={addRowReason}
                      onClick={() => setPending({ kind: "addRow" })}
                    >
                      <Plus className="me-1.5 h-4 w-4" />
                      {t("grid.addRow")}
                    </GuardedButton>
                  ) : undefined
                }
              />
            )
          ) : (
            <div className="animate-in fade-in-0">
              {grid.rowsError && (
                <p className="mb-2 text-xs text-destructive">
                  {grid.rowsError.message}
                </p>
              )}
              <WorkbookGrid
                columns={columns}
                rows={rows!.items}
                refreshing={grid.rowsRefreshing}
                query={query}
                canReorder={reorderReason === null}
                reorderReason={reorderReason}
                crumbs={crumbs}
                workbookEffective={eff}
                onSort={(sortColumn, sortOrder) =>
                  setQuery({ sortColumn, sortOrder, page: 1 })
                }
                onEditRow={(row) => setPending({ kind: "editRow", row })}
                onRetagRow={(row) => setPending({ kind: "retagRow", row })}
                onDeleteRow={(row) => setPending({ kind: "deleteRow", row })}
                onReorder={(ids) =>
                  workbooksService.reorderRows(workbook.id, ids)
                }
              />
              <GridPagination
                page={rows!}
                onPageChange={(page) => setQuery({ page })}
                onPerPageChange={(perPage) => setQuery({ perPage, page: 1 })}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      <RowFormDialog
        open={pending?.kind === "addRow" || pending?.kind === "editRow"}
        onOpenChange={(o) => !o && setPending(null)}
        workbook={workbook}
        columns={columns}
        row={pending?.kind === "editRow" ? pending.row : null}
        storeCode={grid.storeCode}
        storeName={selectedStoreName}
        onSaved={(row, created) => {
          if (created) void grid.fetchRows();
          else grid.upsertRow(row);
        }}
      />

      {pending?.kind === "retagRow" && (
        <VisibilityDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          itemName={t("grid.thisRow")}
          current={pending.row}
          parent={{
            name: workbook.name,
            visibility: workbook.visibility,
            visibilityLabel: workbook.visibilityLabel,
            roles: workbook.visibilityRoles,
          }}
          onSubmit={async (payload) => {
            const saved = await workbooksService.setRowVisibility(
              workbook.id,
              pending.row.id,
              payload,
            );
            grid.upsertRow(saved);
            // Retagging can hide the row from this very view — refetch so the grid tells the truth.
            void grid.fetchRows();
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={pending?.kind === "deleteRow"}
        onOpenChange={(o) => !o && setPending(null)}
        title={t("deleteRow.title")}
        body={t("deleteRow.body")}
        onConfirm={async () => {
          if (pending?.kind !== "deleteRow") return;
          await workbooksService.deleteRow(workbook.id, pending.row.id);
          grid.removeRow(pending.row.id);
          toast.success(t("grid.rowDeleted"));
          void grid.fetchRows();
        }}
      />

      <ColumnEditorDialog
        open={pending?.kind === "columns"}
        onOpenChange={(o) => !o && setPending(null)}
        workbook={workbook}
        rowCount={rows?.total ?? null}
        onSaved={(cols) => {
          if (cols.length) grid.setColumns(cols);
          // Dropped columns take their cells and filters with them.
          const kept = new Set(cols.map((c) => String(c.id)));
          const filters = Object.fromEntries(
            Object.entries(query.filters).filter(([k]) => kept.has(k)),
          );
          const sortColumn =
            query.sortColumn != null && kept.has(String(query.sortColumn))
              ? query.sortColumn
              : null;
          setQuery({ filters, sortColumn });
          void grid.refetch();
        }}
      />

      <WorkbookFormDialog
        open={pending?.kind === "editWorkbook"}
        onOpenChange={(o) => !o && setPending(null)}
        mode="edit"
        workbook={workbook}
        storeCode={grid.storeCode}
        onSaved={(saved) => grid.setWorkbook(saved)}
      />

      {pending?.kind === "retagWorkbook" && (
        <VisibilityDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          itemName={workbook.name}
          current={workbook}
          parent={
            parentFolder
              ? {
                  name: parentFolder.name,
                  visibility: parentFolder.visibility,
                  visibilityLabel: parentFolder.visibilityLabel,
                  roles: parentFolder.visibilityRoles,
                }
              : null
          }
          onSubmit={async (payload) => {
            const saved = await workbooksService.setWorkbookVisibility(
              workbook.id,
              payload,
            );
            grid.setWorkbook(saved);
            void grid.refetch();
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={pending?.kind === "deleteWorkbook"}
        onOpenChange={(o) => !o && setPending(null)}
        title={t("deleteWorkbook.title", { name: workbook.name })}
        body={t("deleteWorkbook.body")}
        onConfirm={async () => {
          await workbooksService.deleteWorkbook(workbook.id);
          toast.success(t("deleteWorkbook.deleted"));
          router.push(folderHref(workbook.folderId));
        }}
      />
    </div>
  );
}
