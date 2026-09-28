"use client";

import { useMemo } from "react";
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
import { GripVertical, Lock, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { blankDraft, needsOptions, type ColumnDraft } from "@/lib/workbooks/columns-diff";
import type { ColumnTypeOption } from "@/types/workbooks.types";
import { ChipInput } from "./chip-input";

interface ColumnEditorProps {
  drafts: ColumnDraft[];
  onChange: (next: ColumnDraft[]) => void;
  columnTypes: ColumnTypeOption[];
  /** draft key → i18n key under workbooks.columns.errors, or a server sentence. */
  errors: Record<string, string>;
  disabled?: boolean;
}

/**
 * The whole column list, in display order. Array order IS the order the
 * server stores, so reordering is just moving items here.
 */
export function ColumnEditor({ drafts, onChange, columnTypes, errors, disabled }: ColumnEditorProps) {
  const t = useTranslations("workbooks.columns");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const typeOptions = useMemo(
    () => columnTypes.map((c) => ({ value: c.value, label: c.label })),
    [columnTypes],
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = drafts.findIndex((d) => d.key === e.active.id);
    const to = drafts.findIndex((d) => d.key === e.over!.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(drafts, from, to));
  };

  const update = (key: string, patch: Partial<ColumnDraft>) =>
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={drafts.map((d) => d.key)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {drafts.map((d, index) => (
              <SortableColumnRow
                key={d.key}
                draft={d}
                index={index}
                typeOptions={typeOptions}
                showOptions={needsOptions(d.type, columnTypes)}
                error={errors[d.key]}
                disabled={disabled}
                canRemove={drafts.length > 1}
                onPatch={(patch) => update(d.key, patch)}
                onRemove={() => onChange(drafts.filter((x) => x.key !== d.key))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        disabled={disabled}
        onClick={() => onChange([...drafts, blankDraft(columnTypes[0]?.value ?? "text")])}
      >
        <Plus className="me-1.5 h-3.5 w-3.5" />
        {t("add")}
      </Button>
    </div>
  );
}

interface SortableColumnRowProps {
  draft: ColumnDraft;
  index: number;
  typeOptions: { value: string; label: string }[];
  showOptions: boolean;
  error?: string;
  disabled?: boolean;
  canRemove: boolean;
  onPatch: (patch: Partial<ColumnDraft>) => void;
  onRemove: () => void;
}

function SortableColumnRow({
  draft,
  index,
  typeOptions,
  showOptions,
  error,
  disabled,
  canRemove,
  onPatch,
  onRemove,
}: SortableColumnRowProps) {
  const t = useTranslations("workbooks.columns");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: draft.key, disabled });
  const isNew = draft.id == null;
  // Error values are either an i18n key under columns.errors or a server sentence.
  const errorText = error ? (t.has(`errors.${error}`) ? t(`errors.${error}`) : error) : null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-lg border bg-card p-2.5 transition-shadow",
        isDragging && "relative z-10 shadow-lg ring-2 ring-primary/20",
        errorText && "border-destructive/50",
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

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
          <div className="relative">
            <Input
              value={draft.name}
              disabled={disabled}
              maxLength={255}
              onChange={(e) => onPatch({ name: e.target.value })}
              placeholder={t("namePlaceholder", { n: index + 1 })}
              aria-label={t("name")}
              aria-invalid={Boolean(errorText) || undefined}
              className="h-9 pe-12"
            />
            {isNew && (
              <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                {t("new")}
              </span>
            )}
          </div>
          {isNew ? (
            <SearchableSelect<string>
              options={typeOptions}
              value={draft.type}
              onChange={(type) => onPatch({ type })}
              disabled={disabled}
              placeholder={t("type")}
              searchPlaceholder={t("typeSearch")}
              emptyText={t("noTypes")}
            />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-9 items-center gap-1.5 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                  <Lock className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {typeOptions.find((o) => o.value === draft.type)?.label ?? draft.type}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{t("typeLocked")}</TooltipContent>
            </Tooltip>
          )}

          {showOptions && (
            <div className="sm:col-span-2 animate-in fade-in-0 slide-in-from-top-1">
              <ChipInput
                value={draft.options}
                onChange={(options) => onPatch({ options })}
                placeholder={t("optionsPlaceholder")}
                addLabel={t("addOption")}
                removeLabel={(o) => t("removeOption", { option: o })}
                disabled={disabled}
                invalid={error === "optionsRequired"}
              />
            </div>
          )}

          <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
            <Checkbox
              checked={draft.required}
              disabled={disabled}
              onCheckedChange={(v) => onPatch({ required: v === true })}
            />
            {t("required")}
          </label>

          {errorText && (
            <p className="text-[11px] text-destructive sm:col-span-2 animate-in fade-in-0">{errorText}</p>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          disabled={disabled || !canRemove}
          onClick={onRemove}
          aria-label={t("remove")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
