"use client";

import { Fragment, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  BellRing,
  ChevronDown,
  ClipboardList,
  Info,
  Loader2,
  Lock,
  MessageSquareText,
  Plus,
  SprayCan,
  Unlock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { CleaningError } from "@/lib/api/services/cleaning.service";
import type {
  EvaluationGrid as Grid,
  EvalRow,
  InspectionItem,
  ItemValue,
  ChartVerdict,
  ChartCell,
  MissingCell,
  PeriodType,
} from "@/types/cleaning.types";
import {
  VALUE_ACCENT,
  VERDICT_ACCENT,
  ValueBadge,
  AccentBadge,
  ScoreOrDash,
  formatScorePct,
  cellBorder as groupBorder,
  headerCell as th,
} from "./cleaning-ui";
import { PeriodPicker } from "./period-picker";
import { GradeItemDialog, type GradeTarget } from "./grade-item-dialog";
import { AllocateWeightDialog, type AllocateTarget } from "./allocate-weight-dialog";
import { CleaningSettingsDialog } from "./cleaning-settings-dialog";

const EMPTY_CELL = { value: "empty" as ItemValue, weight: 1, note: null, photos: [] };

const CHART_GROUPS: {
  key: keyof Grid["rows"][number]["chart"];
}[] = [{ key: "daily" }, { key: "weekly" }, { key: "monthly" }, { key: "hourly" }];

const LEGEND: ItemValue[] = ["pass", "fail", "auto_fail", "not_applicable", "empty"];

const VERDICT_SHORT: Record<ChartVerdict, string> = {
  pass: "P",
  fail: "F",
  not_applicable: "N/A",
};

/** Chart-cell click cycle — pass → fail → not_applicable → pass. Chart cells
 *  never open a dialog (they carry no note/photos), so this quick-toggle is
 *  the entire interaction; clearing to `null` is a separate small "×"
 *  affordance next to the chip once a verdict is set, so cycling can't
 *  silently clear a verdict the specialist didn't mean to remove. */
const CHART_CYCLE: Record<ChartVerdict, ChartVerdict> = {
  pass: "fail",
  fail: "not_applicable",
  not_applicable: "pass",
};

/** Neutral "locked", not a pass/fail color — finalized doesn't mean "good". */
const FINALIZED_ACCENT = { bar: "bg-slate-500", text: "text-slate-700 dark:text-slate-400" };

/** True once at least one inspection item on this row has been scored. */
function hasAnyItemValue(row: EvalRow, items: InspectionItem[]): boolean {
  return items.some((it) => (row.itemValues[it.name]?.value ?? "empty") !== "empty");
}
/** True once at least one chart task on this row has a verdict set. */
function hasAnyChartVerdict(row: EvalRow): boolean {
  return (["daily", "weekly", "monthly", "hourly"] as const).some((g) =>
    row.chart[g].some((c) => c.verdict != null)
  );
}
/** A store with zero activity on both tracks hasn't been evaluated yet — its
 * scores should read "--", not a misleading "0%" (which looks like a real fail). */
function isRowUnevaluated(row: EvalRow, items: InspectionItem[]): boolean {
  return !hasAnyItemValue(row, items) && !hasAnyChartVerdict(row);
}

/**
 * Inline weight editor for one inspection item — a small popover instead of
 * a full dialog since it's a single 1–100 number. Weights are snapshotted
 * per graded cell server-side, so editing this never re-scores an
 * evaluation that already went out (migration guide §10).
 */
function ItemWeightEditor({
  item,
  onUpdate,
}: {
  item: InspectionItem;
  onUpdate: (id: number, weight: number) => Promise<void>;
}) {
  const t = useTranslations("cleaningChart.evaluation.itemWeight");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(item.weight));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(String(item.weight));
  }, [open, item.weight]);

  const parsed = Math.round(Number(value));
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= 100;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await onUpdate(item.id, parsed);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="rounded px-1 text-[10px] font-semibold text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          title={t("title", { weight: item.weight })}
        >
          {t("badge", { weight: item.weight })}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <Label htmlFor={`item-weight-${item.id}`} className="text-xs">
            {t("label")}
          </Label>
          <Input
            id={`item-weight-${item.id}`}
            type="number"
            min={1}
            max={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
            className="h-8"
          />
          <Button size="sm" className="w-full" onClick={handleSave} disabled={saving || !valid}>
            {saving && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
            {t("save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  grid: Grid;
  periodType: PeriodType;
  periodKey: string;
  onLoadPeriod: (periodType: PeriodType, periodKey: string) => void;
  onSetItemCell: (
    storeId: number,
    inspectionItemId: number,
    columnName: string,
    value: ItemValue,
    note?: string,
    images?: File[]
  ) => Promise<void>;
  onSetChartCell: (
    storeId: number,
    cleaningTaskId: number,
    verdict: ChartVerdict | "empty"
  ) => Promise<void>;
  onAddItem: (name: string, weight?: number) => Promise<void>;
  onRemoveItem: (id: number) => Promise<void>;
  onUpdateItemWeight: (id: number, weight: number) => Promise<void>;
  onFinalize: (storeId: number) => Promise<void>;
  /** Super Admin only — omit/false hides the Reopen action entirely rather
   *  than showing a control the backend would 403. */
  canReopen?: boolean;
  onReopen?: (storeId: number) => Promise<void>;
  onAllocateWeight: (
    storeId: number,
    sourceTaskId: number,
    amounts: { targetTaskId: number; amount: number }[]
  ) => Promise<void>;
  onDeleteAllocation: (storeId: number, sourceTaskId: number) => Promise<void>;
  /** Super Admin only — omit/false hides the settings gear entirely rather
   *  than showing a control the backend would 403 on save. */
  canManageSettings?: boolean;
}

export function EvaluationGrid({
  grid,
  periodType,
  periodKey,
  onLoadPeriod,
  onSetItemCell,
  onSetChartCell,
  onAddItem,
  onRemoveItem,
  onUpdateItemWeight,
  onFinalize,
  canReopen,
  onReopen,
  onAllocateWeight,
  onDeleteAllocation,
  canManageSettings,
}: Props) {
  const t = useTranslations("cleaningChart");
  const [gradeTarget, setGradeTarget] = useState<GradeTarget | null>(null);
  const [newItem, setNewItem] = useState("");
  const [newItemWeight, setNewItemWeight] = useState("1");
  const [busy, setBusy] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: number; name: string } | null>(
    null
  );
  const [missingTarget, setMissingTarget] = useState<{
    store: string;
    missing: MissingCell[];
  } | null>(null);
  const [reopenTarget, setReopenTarget] = useState<{ storeId: number; store: string } | null>(
    null
  );
  const [allocateTarget, setAllocateTarget] = useState<AllocateTarget | null>(null);
  // Which stores' full grading detail is expanded — a Set so more than one
  // can be open at once (comparing two stores side by side, one under the
  // other, is a real use case). Column widths never depend on this: the
  // collapsed row is always the same 5 fixed columns regardless of how many
  // inspection items or chart tasks exist, which is the whole point.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpanded = (storeId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const items = grid.items;

  const guard = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("evaluation.toasts.saveFailed"));
    } finally {
      setBusy(null);
    }
  };

  /** Click the chip: pass → fail → not_applicable → pass, starting at pass
   *  for an ungraded cell. */
  const cycleChart = (storeId: number, cell: ChartCell) => {
    const next: ChartVerdict = cell.verdict ? CHART_CYCLE[cell.verdict] : "pass";
    void guard(`c-${storeId}-${cell.taskId}`, () => onSetChartCell(storeId, cell.taskId, next));
  };

  /** The small "×" affordance — a separate action from the cycle so a
   *  specialist can't cycle past their intended state into a silent clear
   *  (guide §5: `empty` is destructive, though chart cells carry no
   *  note/photos to lose, so this itself needs no confirmation). */
  const clearChart = (storeId: number, cell: ChartCell) => {
    void guard(`c-${storeId}-${cell.taskId}`, () => onSetChartCell(storeId, cell.taskId, "empty"));
  };

  /**
   * Finalize needs its own error path rather than `guard`'s generic toast:
   * a 409 with `missing` names the exact ungraded cells (guide §7) — showing
   * "incomplete" alone throws that information away.
   */
  const handleFinalize = async (row: EvalRow) => {
    setBusy(`f-${row.storeId}`);
    try {
      await onFinalize(row.storeId);
      toast.success(t("evaluation.toasts.notified", { store: row.store }));
    } catch (err) {
      if (err instanceof CleaningError && err.code === "CONFLICT" && err.missing?.length) {
        setMissingTarget({ store: row.store, missing: err.missing });
      } else {
        toast.error(err instanceof CleaningError ? err.message : t("evaluation.toasts.saveFailed"));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleReopen = async (target: { storeId: number; store: string }) => {
    if (!onReopen) return;
    setBusy(`r-${target.storeId}`);
    try {
      await onReopen(target.storeId);
      toast.success(t("evaluation.toasts.reopened", { store: target.store }));
      setReopenTarget(null);
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("evaluation.toasts.saveFailed"));
    } finally {
      setBusy(null);
    }
  };

  const renderItemBadge = (row: EvalRow, item: InspectionItem, locked: boolean) => {
    const cell = row.itemValues[item.name] ?? EMPTY_CELL;
    const savingKey = `i-${row.storeId}-${item.id}`;
    const annotated = Boolean(cell.note) || cell.photos.length > 0;
    return (
      <div className="relative inline-flex">
        <ValueBadge
          value={cell.value}
          disabled={busy === savingKey}
          onClick={
            locked
              ? undefined
              : () =>
                  setGradeTarget({
                    storeId: row.storeId,
                    store: row.store,
                    itemId: item.id,
                    itemName: item.name,
                    cell,
                  })
          }
        />
        {/* An icon, not a bare dot — self-explanatory at a glance (and a dot
            relying on hover is meaningless on a touch screen anyway). */}
        {annotated && (
          <span
            className="pointer-events-none absolute -end-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground"
            title={cell.note ? `${t("evaluation.hasNoteTitle")}: ${cell.note}` : t("evaluation.hasNoteTitle")}
          >
            <MessageSquareText className="h-2 w-2" />
          </span>
        )}
      </div>
    );
  };

  const renderChartChip = (row: EvalRow, cell: ChartCell, locked: boolean) => {
    const savingKey = `c-${row.storeId}-${cell.taskId}`;
    const accent = cell.verdict ? VERDICT_ACCENT[cell.verdict] : null;
    const isAllocated = cell.allocatedFrom.length > 0;
    // A historical cell was graded before this task became absent under the
    // current period rules — shown and still scored, but frozen: editing it
    // would silently change a report that already went out (guide §12).
    const cellLocked = locked || cell.historical;
    const baseTitle = isAllocated
      ? t("evaluation.cellWeightTitleAllocated", {
          name: cell.name,
          weight: cell.effectiveWeight,
          base: cell.baseWeight,
          sources: cell.allocatedFrom.map((a) => a.name).join(", "),
        })
      : t("evaluation.cellWeightTitle", { name: cell.name, weight: cell.effectiveWeight });
    const title = cell.historical ? `${baseTitle} — ${t("evaluation.historicalTitle")}` : baseTitle;
    const allocatedTotal = isAllocated
      ? cell.allocatedFrom.reduce((sum, a) => sum + a.amount, 0)
      : 0;
    return (
      <div key={cell.taskId} className="relative">
        <button
          type="button"
          disabled={cellLocked || busy === savingKey}
          onClick={() => cycleChart(row.storeId, cell)}
          title={title}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-start transition-colors",
            cell.verdict && "pe-5",
            accent ? "border bg-card hover:bg-muted/60" : "hover:bg-muted/40",
            busy === savingKey && "opacity-50"
          )}
        >
          {accent && <span className={cn("h-3 w-1 shrink-0 rounded-full", accent.bar)} />}
          <span
            className={cn(
              "min-w-0 flex-1 break-words text-[11px] font-medium leading-snug",
              !accent && "text-muted-foreground"
            )}
          >
            {cell.name}
          </span>
          {/* Weight is always visible here, not tooltip-only — otherwise
              there's no way to tell task importance (or that weight was
              topped up from an absent task) without hovering, which doesn't
              even work on a touch screen. */}
          <span
            className={cn(
              "shrink-0 rounded px-1 py-px text-[9px] font-bold tabular-nums",
              isAllocated
                ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isAllocated ? `${cell.baseWeight}+${allocatedTotal}` : cell.effectiveWeight}
          </span>
          {cell.historical && (
            <Lock className="h-2.5 w-2.5 shrink-0 text-slate-400" aria-hidden="true" />
          )}
          {accent && (
            <span className={cn("shrink-0 text-[10px] font-bold uppercase", accent.text)}>
              {VERDICT_SHORT[cell.verdict as ChartVerdict]}
            </span>
          )}
        </button>
        {cell.verdict && !cellLocked && (
          <button
            type="button"
            disabled={busy === savingKey}
            onClick={(e) => {
              e.stopPropagation();
              clearChart(row.storeId, cell);
            }}
            title={t("evaluation.clearVerdictTitle")}
            className="absolute end-1 top-1.5 rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  };

  const renderFinalizeControl = (row: EvalRow, locked: boolean, finalizing: boolean) => {
    if (locked) {
      return (
        <div className="flex flex-col items-end gap-1">
          <AccentBadge accent={FINALIZED_ACCENT} label={t("evaluation.finalized")} />
          {canReopen && (
            <button
              type="button"
              disabled={busy === `r-${row.storeId}`}
              onClick={(e) => {
                e.stopPropagation();
                setReopenTarget({ storeId: row.storeId, store: row.store });
              }}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <Unlock className="h-3 w-3" />
              {t("evaluation.reopen")}
            </button>
          )}
        </div>
      );
    }
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={finalizing}
        onClick={(e) => {
          e.stopPropagation();
          void handleFinalize(row);
        }}
      >
        {finalizing ? (
          <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
        ) : (
          <BellRing className="me-1.5 h-4 w-4" />
        )}
        {t("evaluation.finalize")}
      </Button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Actions row — flat toolbar, matches the app pattern ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker periodType={periodType} periodKey={periodKey} onChange={onLoadPeriod} />

        <div className="flex flex-1 items-center gap-2 sm:flex-none">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newItem.trim() && busy !== "add") {
                const weight = Number(newItemWeight);
                guard("add", async () => {
                  await onAddItem(newItem.trim(), Number.isFinite(weight) ? weight : undefined);
                  setNewItem("");
                  setNewItemWeight("1");
                });
              }
            }}
            placeholder={t("evaluation.addItemPlaceholder")}
            className="h-9 min-w-0 flex-1 sm:w-44 sm:flex-none"
          />
          {/* Weight at creation time — the only other place to change it
              afterwards is the per-item editor inside a store's expanded row. */}
          <div className="relative shrink-0">
            <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-[10px] font-semibold text-muted-foreground">
              {t("evaluation.weightPrefix")}
            </span>
            <Input
              type="number"
              min={1}
              max={100}
              value={newItemWeight}
              onChange={(e) => setNewItemWeight(e.target.value)}
              title={t("evaluation.newItemWeightTitle")}
              className="h-9 w-[4.5rem] ps-7 text-center"
            />
          </div>
          <Button
            disabled={!newItem.trim() || busy === "add"}
            onClick={() => {
              const weight = Number(newItemWeight);
              guard("add", async () => {
                await onAddItem(newItem.trim(), Number.isFinite(weight) ? weight : undefined);
                setNewItem("");
                setNewItemWeight("1");
              });
            }}
          >
            {busy === "add" ? (
              <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="me-1.5 h-4 w-4" />
            )}
            <span className="hidden sm:inline">{t("evaluation.add")}</span>
          </Button>

          {canManageSettings && <CleaningSettingsDialog />}
        </div>
      </div>

      {/* Legend — always visible, no click required to see what the colors mean. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          {t("evaluation.legendLabel")}
        </span>
        {LEGEND.map((value) => (
          <span
            key={value}
            className="flex items-center gap-1.5"
            title={t(`evaluation.itemValueExplain.${value}`)}
          >
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", VALUE_ACCENT[value].bar)} />
            <span className="font-medium text-foreground/80">{t(`itemValue.${value}`)}</span>
          </span>
        ))}

        <span className="hidden h-4 w-px bg-border sm:block" />

        {/* Symbols that appear ON cells, not just value colors — same
            always-visible treatment so nothing here depends on a hover
            that doesn't even work on a touch screen. */}
        <span
          className="flex items-center gap-1"
          title={t("evaluation.legendWeightExplain")}
        >
          <span className="rounded bg-muted px-1 py-px text-[9px] font-bold text-muted-foreground">5</span>
          <span className="font-medium text-foreground/80">{t("evaluation.legendWeight")}</span>
        </span>
        <span
          className="flex items-center gap-1"
          title={t("evaluation.legendAllocatedExplain")}
        >
          <span className="rounded bg-amber-500/20 px-1 py-px text-[9px] font-bold text-amber-700 dark:text-amber-400">
            3+2
          </span>
          <span className="font-medium text-foreground/80">{t("evaluation.legendAllocated")}</span>
        </span>
        <span className="flex items-center gap-1.5" title={t("evaluation.hasNoteTitle")}>
          <MessageSquareText className="h-3 w-3 shrink-0 text-primary" />
          <span className="font-medium text-foreground/80">{t("evaluation.legendNote")}</span>
        </span>
        <span className="flex items-center gap-1.5" title={t("evaluation.historicalTitle")}>
          <Lock className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="font-medium text-foreground/80">{t("evaluation.legendHistorical")}</span>
        </span>

        <span className="hidden text-muted-foreground/80 sm:ms-auto sm:block">
          {t("evaluation.legendHint")}
        </span>
      </div>

      {/* ── Empty state ── */}
      {grid.rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("evaluation.noStores.title")}</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {t("evaluation.noStores.description")}
            </p>
          </div>
        </div>
      ) : (
        /**
         * A compact, FIXED-width table — one row per store — that expands
         * in place to the full grading detail. Column widths never depend on
         * how many inspection items or chart tasks exist (that data only
         * ever appears inside the expanded panel, full-width), which is what
         * actually fixes the horizontal-scroll/variable-row-width problem a
         * "columns per item/task" table structure can't avoid at any screen
         * size. The two lower-priority score columns fold into a summary
         * line under the store name below `sm`/`md`, the same progressive
         * column-hide technique already used in `due-list.tsx`.
         */
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/70 text-muted-foreground">
                <th className={cn("text-start", th, groupBorder)}>{t("evaluation.columns.store")}</th>
                <th
                  className={cn("hidden text-center sm:table-cell", th, groupBorder)}
                  title={t("evaluation.columns.itemScoreExplain")}
                >
                  {t("evaluation.columns.itemScore")}
                </th>
                <th
                  className={cn("hidden text-center md:table-cell", th, groupBorder)}
                  title={t("evaluation.columns.chartScoreExplain")}
                >
                  {t("evaluation.columns.chartScore")}
                </th>
                <th
                  className={cn("text-center", th, groupBorder)}
                  title={t("evaluation.columns.finalScoreExplain")}
                >
                  {t("evaluation.columns.finalScore")}
                </th>
                <th className={cn("text-end", th)}>{t("evaluation.columns.notify")}</th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => {
                const finalizing = busy === `f-${row.storeId}`;
                const unevaluated = isRowUnevaluated(row, items);
                // Locked once finalized — any write 409s server-side anyway,
                // but disabling proactively avoids a failed round trip and
                // communicates the state instead of a mysterious error.
                const locked = row.finalizedAt != null;
                const isOpen = expanded.has(row.storeId);
                const activeGroups = CHART_GROUPS.filter((g) => row.chart[g.key].length > 0);
                // Only a monthly task legitimately goes "absent" (due once
                // every 4 weeks, per guide §2.1/§11) — daily/weekly/hourly
                // tasks are supposed to be in-play every period, so the
                // reallocation flow (link, dialog) only ever offers monthly
                // tasks regardless of what the API happens to include here.
                const monthlyAbsentTasks = row.absentTasks.filter((a) => a.frequency === "monthly");

                return (
                  <Fragment key={row.storeId}>
                    <tr
                      onClick={() => toggleExpanded(row.storeId)}
                      className={cn(
                        "cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/40",
                        isOpen && "bg-muted/30"
                      )}
                    >
                      <td className={cn("px-3 py-2.5", groupBorder)}>
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                              isOpen && "rotate-180"
                            )}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{row.store}</p>
                            {/* Folds the two hidden score columns back in below `md`. */}
                            <p className="text-xs text-muted-foreground md:hidden">
                              {unevaluated ? (
                                "--"
                              ) : (
                                <>
                                  {t("evaluation.columns.itemScore")}{" "}
                                  {formatScorePct(row.itemScore)}%
                                  <span className="mx-1">·</span>
                                  {t("evaluation.columns.chartScore")}{" "}
                                  {formatScorePct(row.chartScore)}%
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={cn("hidden text-center sm:table-cell", groupBorder)}>
                        <ScoreOrDash pct={row.itemScore} unevaluated={unevaluated} className="text-sm" />
                      </td>
                      <td className={cn("hidden text-center md:table-cell", groupBorder)}>
                        <ScoreOrDash pct={row.chartScore} unevaluated={unevaluated} className="text-sm" />
                      </td>
                      <td className={cn("text-center", groupBorder)}>
                        <div className="flex flex-col items-center gap-0.5">
                          {/* The headline metric — visually heavier than the
                              two secondary scores either side of it. */}
                          <ScoreOrDash
                            pct={row.finalScore ?? 0}
                            unevaluated={row.finalScore == null}
                            className="text-base font-bold"
                          />
                          {row.finalScore != null && row.scoreSides.length === 1 && (
                            <span className="hidden text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">
                              {t(`evaluation.scoreSide.${row.scoreSides[0]}`)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        <div className="flex justify-end">{renderFinalizeControl(row, locked, finalizing)}</div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr key={`${row.storeId}-detail`} className="border-t border-border/60 bg-muted/10">
                        <td colSpan={5} className="p-4 sm:p-5">
                          <div className="space-y-5">
                            {/* Completion / absent-tasks status — a small
                                banner rather than plain text, so it reads as
                                a status to act on, not a caption to skim past. */}
                            {((!locked && !row.isComplete && !unevaluated) ||
                              monthlyAbsentTasks.length > 0) && (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                                {!locked && !row.isComplete && !unevaluated && (
                                  <span title={t("evaluation.completionHintExplain")}>
                                    {t("evaluation.completionHint", {
                                      graded: row.gradedCount,
                                      required: row.requiredCount,
                                    })}
                                  </span>
                                )}
                                {monthlyAbsentTasks.length > 0 && (
                                  <button
                                    type="button"
                                    title={t("evaluation.absentTasksLinkExplain")}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAllocateTarget({ storeId: row.storeId, store: row.store, row });
                                    }}
                                    className="font-medium underline-offset-2 hover:underline"
                                  >
                                    {t("evaluation.absentTasksLink", { count: monthlyAbsentTasks.length })}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Inspection items — responsive grid, never wider than the viewport */}
                            {items.length > 0 && (
                              <div className="space-y-2">
                                <p className="flex items-baseline gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  <ClipboardList className="h-3 w-3 self-center" />
                                  {t("evaluation.columns.inspectionItems")}
                                  <span className="font-normal normal-case text-muted-foreground/60">
                                    · {items.length}
                                  </span>
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                  {items.map((it) => (
                                    <div
                                      key={it.id}
                                      className="flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1.5"
                                    >
                                      <span className="inline-flex min-w-0 items-center gap-1">
                                        <span className="truncate text-sm" title={it.name}>
                                          {it.name}
                                        </span>
                                        <ItemWeightEditor item={it} onUpdate={onUpdateItemWeight} />
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setRemoveTarget({ id: it.id, name: it.name });
                                          }}
                                          className="shrink-0 text-muted-foreground/50 transition-colors hover:text-destructive"
                                          title={t("evaluation.removeItemTitle")}
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                      {renderItemBadge(row, it, locked)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Cleaning chart, grouped — only groups with tasks in play.
                                `flex-wrap` + `items-start` (not `grid`) so a short group
                                like Hourly never gets stretched to match a long one like
                                Daily; a group past 6 tasks also switches to two internal
                                columns so it doesn't tower over its neighbors either. */}
                            {activeGroups.length > 0 && (
                              <div className="space-y-2">
                                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  <SprayCan className="h-3 w-3" />
                                  {t("evaluation.columns.cleaningChart")}
                                </p>
                                <div className="flex flex-wrap items-start gap-3">
                                  {activeGroups.map((g) => {
                                    const cells = row.chart[g.key];
                                    const dense = cells.length > 6;
                                    return (
                                      <div
                                        key={g.key}
                                        className="min-w-[180px] flex-1 space-y-1.5 rounded-lg border bg-card/50 p-2.5"
                                      >
                                        <p className="flex items-baseline gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          {t(`frequency.${g.key}`)}
                                          <span className="font-normal normal-case text-muted-foreground/60">
                                            · {cells.length}
                                          </span>
                                        </p>
                                        <div className={cn(dense ? "grid grid-cols-1 gap-1 sm:grid-cols-2" : "space-y-1")}>
                                          {cells.map((cell) => renderChartChip(row, cell, locked))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && grid.rows.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {t("evaluation.noItems")}
        </p>
      )}

      {/* Confirm remove inspection item */}
      <AlertDialog
        open={removeTarget != null}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("evaluation.removeDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("evaluation.removeDialog.description", { name: removeTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy?.startsWith("rm-")}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                const target = removeTarget;
                if (!target) return;
                void guard(`rm-${target.id}`, async () => {
                  await onRemoveItem(target.id);
                  setRemoveTarget(null);
                });
              }}
            >
              {busy?.startsWith("rm-") ? (
                <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
              ) : null}
              {t("evaluation.removeDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Grade an inspection-item cell (verdict + note + images) */}
      <GradeItemDialog
        target={gradeTarget}
        onOpenChange={(o) => !o && setGradeTarget(null)}
        onSubmit={({ storeId, itemId, itemName, value, note, images }) =>
          onSetItemCell(storeId, itemId, itemName, value, note, images)
        }
      />

      {/* Finalize blocked — names the exact ungraded cells (guide §7) */}
      <AlertDialog
        open={missingTarget != null}
        onOpenChange={(o) => !o && setMissingTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("evaluation.missingDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("evaluation.missingDialog.description", { store: missingTarget?.store ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-60 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
            {missingTarget?.missing.map((m) => (
              <li key={`${m.kind}-${m.id}`} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(`evaluation.missingDialog.kind.${m.kind}`)}
                </span>
                <span className="truncate">{m.name}</span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setMissingTarget(null)}>
              {t("common.close")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reopen — Super Admin only; unfreezes scores back to live computation */}
      <AlertDialog
        open={reopenTarget != null}
        onOpenChange={(o) => !o && setReopenTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("evaluation.reopenDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("evaluation.reopenDialog.description", { store: reopenTarget?.store ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy?.startsWith("r-")}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                const target = reopenTarget;
                if (!target) return;
                void handleReopen(target);
              }}
              disabled={busy?.startsWith("r-")}
            >
              {busy?.startsWith("r-") ? (
                <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
              ) : null}
              {t("evaluation.reopenDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Allocate an absent task's weight across this period's in-play tasks */}
      <AllocateWeightDialog
        target={allocateTarget}
        onOpenChange={(o) => !o && setAllocateTarget(null)}
        onAllocate={onAllocateWeight}
        onDeleteAllocation={onDeleteAllocation}
      />
    </div>
  );
}
