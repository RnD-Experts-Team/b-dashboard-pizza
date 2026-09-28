"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Shield,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cellKey, useWorkbookGridStore } from "@/lib/store/workbook-grid.store";
import { isCancelled } from "@/lib/workbooks/errors";
import { formatDay, formatTimestamp, wasUpdated } from "@/lib/workbooks/dates";
import type {
  Breadcrumb,
  EffectiveVisibility,
  RowsQuery,
  WorkbookColumn,
  WorkbookRow,
} from "@/types/workbooks.types";
import { GridCell } from "./grid-cell";
import { MenuRow, useDenyReason, useErrorText } from "./guarded";
import { VisibilityChip } from "./visibility-chip";

interface WorkbookGridProps {
  columns: WorkbookColumn[];
  rows: WorkbookRow[];
  refreshing: boolean;
  query: RowsQuery;
  /** Drag-reorder allowed: workbook edit right AND manual order, unfiltered. */
  canReorder: boolean;
  /** Why reordering is off, for the handle tooltip. */
  reorderReason: string | null;
  crumbs: Breadcrumb[];
  workbookEffective: EffectiveVisibility | null;
  onSort: (columnId: number | null, order: "asc" | "desc") => void;
  onEditRow: (row: WorkbookRow) => void;
  onRetagRow: (row: WorkbookRow) => void;
  onDeleteRow: (row: WorkbookRow) => void;
  onReorder: (orderedIds: number[]) => Promise<void>;
}

/**
 * The grid: sticky first column for the handle + row actions, one column per
 * workbook column in `position` order, horizontal scroll for wide tables.
 * Every control reads the ROW's own `viewer.can` — it already accounts for the
 * workbook and folders above it.
 */
export function WorkbookGrid({
  columns,
  rows,
  refreshing,
  query,
  canReorder,
  reorderReason,
  crumbs,
  workbookEffective,
  onSort,
  onEditRow,
  onRetagRow,
  onDeleteRow,
  onReorder,
}: WorkbookGridProps) {
  const t = useTranslations("workbooks.grid");
  const errorText = useErrorText();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const reorderLocal = useWorkbookGridStore((s) => s.reorderLocal);

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = rows.map((r) => r.id);
    const from = ids.indexOf(Number(e.active.id));
    const to = ids.indexOf(Number(e.over.id));
    if (from < 0 || to < 0) return;
    const before = ids;
    const next = arrayMove(ids, from, to);
    reorderLocal(next);
    try {
      await onReorder(next);
      toast.success(t("reordered"));
    } catch (err) {
      reorderLocal(before);
      if (!isCancelled(err))
        toast.error(errorText(err, crumbs) || t("reorderFailed"));
    }
  };

  const sortIcon = (c: WorkbookColumn) => {
    if (query.sortColumn !== c.id)
      return (
        <ArrowUpDown className="h-3 w-3 opacity-40 group-hover/th:opacity-80" />
      );
    return query.sortOrder === "desc" ? (
      <ArrowDown className="h-3 w-3 text-primary" />
    ) : (
      <ArrowUp className="h-3 w-3 text-primary" />
    );
  };

  const cycleSort = (c: WorkbookColumn) => {
    if (query.sortColumn !== c.id) onSort(c.id, "asc");
    else if (query.sortOrder === "asc") onSort(c.id, "desc");
    else onSort(null, "asc");
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm transition-opacity",
        refreshing && "pointer-events-none opacity-60",
      )}
    >
      {/* DndContext renders its screen-reader announcer as <div>s beside its
          children, so it must wrap the table — never sit inside it. */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => void onDragEnd(e)}
      >
        <div className="overflow-x-auto" onWheel={(e) => e.stopPropagation()}>
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="sticky start-0 z-20 w-[72px] min-w-[72px] border-e bg-muted px-2 py-2 text-start">
                  <span className="sr-only">{t("rowActions")}</span>
                </th>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={
                      query.sortColumn === c.id
                        ? query.sortOrder === "desc"
                          ? "descending"
                          : "ascending"
                        : undefined
                    }
                    className="min-w-[160px] max-w-[320px] px-1 py-1 text-start align-bottom font-normal"
                  >
                    <button
                      type="button"
                      onClick={() => cycleSort(c)}
                      className="group/th flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-start transition-colors hover:bg-accent"
                      title={t("sortBy", { name: c.name })}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-foreground">
                          {c.name}
                          {c.required && (
                            <span className="ms-0.5 text-destructive">*</span>
                          )}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                          {c.typeLabel ?? c.type}
                        </span>
                      </span>
                      {sortIcon(c)}
                    </button>
                  </th>
                ))}
                <th className="min-w-[170px] px-3 py-2 text-start text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("access")}
                </th>
              </tr>
            </thead>
            <SortableContext
              items={rows.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {rows.map((row) => (
                  <GridRow
                    key={row.id}
                    row={row}
                    columns={columns}
                    canReorder={canReorder}
                    reorderReason={reorderReason}
                    crumbs={crumbs}
                    workbookEffective={workbookEffective}
                    onEdit={() => onEditRow(row)}
                    onRetag={() => onRetagRow(row)}
                    onDelete={() => onDeleteRow(row)}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </DndContext>
    </div>
  );
}

function GridRow({
  row,
  columns,
  canReorder,
  reorderReason,
  crumbs,
  workbookEffective,
  onEdit,
  onRetag,
  onDelete,
}: {
  row: WorkbookRow;
  columns: WorkbookColumn[];
  canReorder: boolean;
  reorderReason: string | null;
  crumbs: Breadcrumb[];
  workbookEffective: EffectiveVisibility | null;
  onEdit: () => void;
  onRetag: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("workbooks.grid");
  const denyReason = useDenyReason();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id,
    disabled: !canReorder,
  });
  const savingCells = useWorkbookGridStore((s) => s.savingCells);
  const cellErrors = useWorkbookGridStore((s) => s.cellErrors);
  const allowedOverride = useWorkbookGridStore((s) => s.allowedOverride);
  const flashedAt = useWorkbookGridStore((s) => s.flashed[row.id]);
  const saveCell = useWorkbookGridStore((s) => s.saveCell);
  const clearCellError = useWorkbookGridStore((s) => s.clearCellError);

  // A saved row glows briefly, then fades back.
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!flashedAt) return;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(id);
  }, [flashedAt]);

  // Created / updated, short on the row and in full on hover.
  const tc = useTranslations("workbooks.contents");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const edited = wasUpdated(row.createdAt, row.updatedAt);
  const shortDay = formatDay(edited ? row.updatedAt : row.createdAt, locale);
  const rowDate = shortDay ? tc(edited ? "updated" : "created", { date: shortDay }) : null;
  const fullCreated = formatTimestamp(row.createdAt, locale);
  const fullUpdated = formatTimestamp(row.updatedAt, locale);
  const rowTimes = [
    fullCreated && tc("created", { date: fullCreated }),
    edited && fullUpdated && tc("updated", { date: fullUpdated }),
  ]
    .filter(Boolean)
    .join(" · ");

  // Rows get the row-level deny reason; the workbook's cap explains most of them.
  const effective = workbookEffective;

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group border-b transition-colors duration-700 last:border-b-0",
        flash ? "bg-emerald-500/10" : "hover:bg-muted/30",
        isDragging && "relative z-30 bg-card shadow-lg",
      )}
    >
      <td
        className={cn(
          "sticky start-0 z-10 border-e px-1 py-1 align-top transition-colors duration-700",
          flash
            ? "bg-emerald-50 dark:bg-emerald-950"
            : "bg-card group-hover:bg-muted",
        )}
      >
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                ref={setActivatorNodeRef}
                {...(canReorder ? { ...attributes, ...listeners } : {})}
                aria-disabled={!canReorder}
                className={cn(
                  "flex h-8 w-6 touch-none items-center justify-center rounded text-muted-foreground transition-colors",
                  canReorder
                    ? "cursor-grab hover:bg-accent hover:text-foreground active:cursor-grabbing"
                    : "cursor-not-allowed opacity-40",
                )}
                aria-label={t("dragRow")}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            {!canReorder && reorderReason && (
              <TooltipContent className="max-w-xs">
                {reorderReason}
              </TooltipContent>
            )}
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={t("rowActions")}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <MenuRow
                icon={Pencil}
                label={t("editRow")}
                reason={denyReason(row.can.edit, effective, crumbs)}
                onSelect={onEdit}
              />
              <MenuRow
                icon={Shield}
                label={t("rowAccess")}
                reason={denyReason(row.can.changeVisibility, effective, crumbs)}
                onSelect={onRetag}
              />
              <DropdownMenuSeparator />
              <MenuRow
                icon={Trash2}
                label={t("deleteRow")}
                destructive
                reason={denyReason(row.can.delete, effective, crumbs)}
                onSelect={onDelete}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
      {columns.map((c) => {
        const key = cellKey(row.id, c.id);
        return (
          <td
            key={c.id}
            className="min-w-[160px] max-w-[320px] px-1 py-1 align-top"
          >
            <GridCell
              column={c}
              value={row.cells[String(c.id)] ?? null}
              editable={row.can.edit}
              saving={Boolean(savingCells[key])}
              error={cellErrors[key] ?? null}
              allowed={allowedOverride[String(c.id)]}
              onSave={(raw) => saveCell(row, c, raw)}
              onClearError={() => clearCellError(row.id, c.id)}
            />
          </td>
        );
      })}
      <td className="px-3 py-2 align-top">
        <div className="space-y-1">
          <VisibilityChip
            value={row.visibility}
            label={row.visibilityLabel}
            roles={row.visibilityRoles}
          />
          <div
            className="max-w-[220px] space-y-0.5 text-[10px] leading-snug text-muted-foreground"
            title={rowTimes}
          >
            <p className="truncate">
              {[
                row.createdBy?.name,
                row.store &&
                  (row.store.name && row.store.name !== row.store.storeNumber
                    ? `${row.store.name} (${row.store.storeNumber})`
                    : row.store.storeNumber),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {rowDate && <p className="truncate tabular-nums">{rowDate}</p>}
          </div>
        </div>
      </td>
    </tr>
  );
}
