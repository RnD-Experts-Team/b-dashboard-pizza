"use client";

import { useMemo, useState } from "react";
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
import { FunctionSquare, GripVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableSelect } from "@/components/shared/searchable-select";
import {
  isFormulaColumn,
  type DatasetColumn,
  type DatasetRef,
  type ReportColumn,
} from "@/lib/report-builder/definition";
import type { Aggregation, CatalogColumn, CatalogDatasetRef, GrainKey } from "@/types/report-builder.types";

const GROUP_VALUE = "__group__";
/** Pointer travel before a drag starts, so clicks on the handle stay clicks. */
const DRAG_ACTIVATION_PX = 6;
/** The aggregation a new measure column starts with, when the column allows it. */
const PREFERRED_AGGREGATIONS: readonly Aggregation[] = ["sum", "count", "avg", "max", "min", "count_distinct"];

export interface ColumnSource {
  ref: DatasetRef;
  dataset: CatalogDatasetRef;
}

interface ColumnPickerProps {
  columns: ReportColumn[];
  sources: ColumnSource[];
  grain: GrainKey[];
  /** column id → already-translated problem text. */
  errors: Record<string, string>;
  onChange: (next: ReportColumn[]) => void;
  /** Adds a dataset column with a fresh id (the builder owns ids). */
  onAddColumn: (column: Omit<DatasetColumn, "id">) => void;
  onAddFormula: () => void;
  onEditFormula: (id: string) => void;
  disabled?: boolean;
}

const isGrainColumn = (col: CatalogColumn, grain: GrainKey[]) => (grain as string[]).includes(col.key);

/** A column listed as-is (no aggregation): a grain key, or a groupable dimension that breaks the report down. */
const isGroupColumn = (col: CatalogColumn, grain: GrainKey[]) => isGrainColumn(col, grain) || col.groupable === true;

/** A column can be in the report when it can be listed as-is, is computed, or can be aggregated. */
function canSelectColumn(col: CatalogColumn, grain: GrainKey[]): boolean {
  return isGroupColumn(col, grain) || col.derived === true || (col.aggregations ?? []).length > 0;
}

export function defaultAggregation(col: CatalogColumn, grain: GrainKey[]): Aggregation | null {
  if (isGrainColumn(col, grain)) return null;
  const allowed = col.aggregations ?? [];
  // A dimension with nothing to aggregate (status, part, location) is a breakdown column.
  return PREFERRED_AGGREGATIONS.find((a) => allowed.includes(a)) ?? allowed[0] ?? null;
}

/**
 * The report's columns in display order (drag to reorder, like the workbook
 * column editor). Each dataset column has a label and an aggregation from the
 * column's own list; grain columns are "Group by". Formula columns sit in the
 * same list and open the formula dialog.
 */
export function ColumnPicker({
  columns,
  sources,
  grain,
  errors,
  onChange,
  onAddColumn,
  onAddFormula,
  onEditFormula,
  disabled,
}: ColumnPickerProps) {
  const t = useTranslations("reportBuilder.columns");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = columns.findIndex((c) => c.id === e.active.id);
    const to = columns.findIndex((c) => c.id === e.over?.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(columns, from, to));
  };

  const patch = (id: string, next: Partial<ReportColumn>) =>
    onChange(columns.map((c) => (c.id === id ? ({ ...c, ...next } as ReportColumn) : c)));

  const sourceOf = (alias: string) => sources.find((s) => s.ref.alias === alias);

  return (
    <div data-slot="column-picker" className="space-y-2">
      {columns.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {columns.map((c) => (
              <SortableColumnRow
                key={c.id}
                column={c}
                source={isFormulaColumn(c) ? undefined : sourceOf(c.alias)}
                grain={grain}
                error={errors[c.id]}
                disabled={disabled}
                onPatch={(next) => patch(c.id, next)}
                onRemove={() => onChange(columns.filter((x) => x.id !== c.id))}
                onEditFormula={() => onEditFormula(c.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <AddColumnButton sources={sources} grain={grain} disabled={disabled || sources.length === 0} onAdd={onAddColumn} />
        <Button type="button" variant="outline" size="sm" className="border-dashed" disabled={disabled} onClick={onAddFormula}>
          <FunctionSquare className="me-1.5 h-3.5 w-3.5" />
          {t("addFormula")}
        </Button>
      </div>
    </div>
  );
}

function AddColumnButton({
  sources,
  grain,
  disabled,
  onAdd,
}: {
  sources: ColumnSource[];
  grain: GrainKey[];
  disabled?: boolean;
  onAdd: (column: Omit<DatasetColumn, "id">) => void;
}) {
  const t = useTranslations("reportBuilder.columns");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sources
      .map((s) => ({
        source: s,
        items: s.dataset.columns.filter(
          (c) => !needle || c.key.toLowerCase().includes(needle) || (c.label ?? "").toLowerCase().includes(needle),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [sources, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="border-dashed" disabled={disabled}>
          <Plus className="me-1.5 h-3.5 w-3.5" />
          {t("add")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className="h-7 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
          {groups.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("noColumns")}</p>}
          {groups.map((g) => (
            <div key={g.source.ref.alias} className="py-1">
              <p className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="rounded bg-primary/10 px-1 font-mono text-primary">{g.source.ref.alias}</span>
                {g.source.dataset.label}
              </p>
              {g.items.map((c) => {
                const usable = canSelectColumn(c, grain);
                return (
                  <button
                    key={c.key}
                    type="button"
                    disabled={!usable}
                    title={usable ? undefined : t("filterOnly")}
                    onClick={() => {
                      onAdd({
                        alias: g.source.ref.alias,
                        column: c.key,
                        agg: defaultAggregation(c, grain),
                        label: c.label ?? c.key,
                      });
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.label ?? c.key}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {c.key} · {c.type}
                      </span>
                    </span>
                    {!usable && <span className="shrink-0 text-[10px] text-muted-foreground">{t("filterOnlyShort")}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface SortableColumnRowProps {
  column: ReportColumn;
  source?: ColumnSource;
  grain: GrainKey[];
  error?: string;
  disabled?: boolean;
  onPatch: (next: Partial<ReportColumn>) => void;
  onRemove: () => void;
  onEditFormula: () => void;
}

function SortableColumnRow({ column, source, grain, error, disabled, onPatch, onRemove, onEditFormula }: SortableColumnRowProps) {
  const t = useTranslations("reportBuilder.columns");
  const ta = useTranslations("reportBuilder.agg");
  const tc = useTranslations("reportBuilder.common");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    disabled,
  });

  const formula = isFormulaColumn(column);
  const catalogColumn = !formula ? source?.dataset.columns.find((c) => c.key === column.column) : undefined;
  const grainColumn = catalogColumn ? isGrainColumn(catalogColumn, grain) : false;
  const groupColumn = catalogColumn ? isGroupColumn(catalogColumn, grain) : false;

  const aggOptions = useMemo(() => {
    const groupOption = groupColumn ? [{ value: GROUP_VALUE, label: grainColumn ? t("group") : t("breakdown") }] : [];
    const aggs = (catalogColumn?.aggregations ?? []).map((a) => ({ value: a as string, label: ta(a) }));
    return [...groupOption, ...aggs];
  }, [catalogColumn, grainColumn, groupColumn, t, ta]);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-lg border bg-card p-2.5 transition-shadow",
        isDragging && "relative z-10 shadow-lg ring-2 ring-primary/20",
        error && "border-destructive/50",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="mt-2 cursor-grab touch-none rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
          aria-label={t("drag")}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:col-span-2">
            <span className="rounded bg-muted px-1 font-mono">{column.id}</span>
            {formula ? (
              <>
                <FunctionSquare className="h-3 w-3 shrink-0 text-primary" />
                <code className="truncate font-mono" title={column.expr}>
                  {column.expr}
                </code>
              </>
            ) : (
              <>
                <span className="rounded bg-primary/10 px-1 font-mono text-primary">{column.alias}</span>
                <span className="truncate font-mono">{column.column}</span>
              </>
            )}
          </div>

          <Input
            value={column.label}
            disabled={disabled}
            maxLength={120}
            onChange={(e) => onPatch({ label: e.target.value })}
            placeholder={t("label")}
            aria-label={t("label")}
            aria-invalid={Boolean(error) || undefined}
            className="h-9"
          />

          {formula ? (
            <Button type="button" variant="outline" size="sm" className="h-9" disabled={disabled} onClick={onEditFormula}>
              <Pencil className="me-1.5 h-3.5 w-3.5" />
              {t("editFormula")}
            </Button>
          ) : (
            <SearchableSelect<string>
              options={aggOptions}
              value={column.agg ?? (groupColumn ? GROUP_VALUE : "")}
              onChange={(v) => onPatch({ agg: v === GROUP_VALUE ? null : (v as Aggregation) })}
              disabled={disabled || aggOptions.length === 0}
              placeholder={t("aggregation")}
              searchPlaceholder={tc("search")}
              emptyText={tc("noResults")}
            />
          )}

          {error && <p className="text-[11px] text-destructive animate-in fade-in-0 sm:col-span-2">{error}</p>}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          disabled={disabled}
          onClick={onRemove}
          aria-label={t("remove")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
