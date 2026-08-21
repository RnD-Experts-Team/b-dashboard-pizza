"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  BellRing,
  ClipboardList,
  Loader2,
  Plus,
  SprayCan,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  PeriodType,
} from "@/types/cleaning.types";
import {
  VALUE_ACCENT,
  VERDICT_ACCENT,
  ValueBadge,
  ScoreOrDash,
  cellBorder as groupBorder,
  headerCell as th,
} from "./cleaning-ui";
import { PeriodPicker } from "./period-picker";
import { GradeItemDialog, type GradeTarget } from "./grade-item-dialog";

const EMPTY_CELL = { value: "empty" as ItemValue, note: null, photos: [] };

const CHART_GROUPS: {
  key: keyof Grid["rows"][number]["chart"];
}[] = [{ key: "daily" }, { key: "weekly" }, { key: "monthly" }, { key: "hourly" }];

const LEGEND: ItemValue[] = ["pass", "fail", "auto_fail", "empty"];

const VERDICT_SHORT: Record<ChartVerdict, string> = {
  pass: "P",
  fail: "F",
  auto_fail: "A",
};

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
    verdict: ChartVerdict
  ) => Promise<void>;
  onAddItem: (name: string) => Promise<void>;
  onRemoveItem: (id: number) => Promise<void>;
  onFinalize: (storeId: number) => Promise<void>;
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
  onFinalize,
}: Props) {
  const t = useTranslations("cleaningChart");
  const [gradeTarget, setGradeTarget] = useState<GradeTarget | null>(null);
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: number; name: string } | null>(
    null
  );

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

  const toggleChart = (storeId: number, cell: ChartCell) => {
    const next: ChartVerdict = cell.verdict === "pass" ? "fail" : "pass";
    void guard(`c-${storeId}-${cell.taskId}`, () => onSetChartCell(storeId, cell.taskId, next));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Actions row — flat toolbar, matches the app pattern ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker
          periodType={periodType}
          periodKey={periodKey}
          onChange={onLoadPeriod}
        />

        <div className="flex items-center gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newItem.trim() && busy !== "add") {
                guard("add", async () => {
                  await onAddItem(newItem.trim());
                  setNewItem("");
                });
              }
            }}
            placeholder={t("evaluation.addItemPlaceholder")}
            className="h-9 w-48"
          />
          <Button
            disabled={!newItem.trim() || busy === "add"}
            onClick={() =>
              guard("add", async () => {
                await onAddItem(newItem.trim());
                setNewItem("");
              })
            }
          >
            {busy === "add" ? (
              <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="me-1.5 h-4 w-4" />
            )}
            {t("evaluation.add")}
          </Button>
        </div>
      </div>

      {/* Legend + hint */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
          {t("evaluation.legendLabel")}
        </span>
        {LEGEND.map((value) => (
          <span key={value} className="flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("h-3 w-1 rounded-full", VALUE_ACCENT[value].bar)} />
            {t(`itemValue.${value}`)}
          </span>
        ))}
        <span className="ms-auto hidden text-muted-foreground/80 md:block">
          {t("evaluation.legendHint")}
        </span>
      </div>

      {/* ── The grid ── */}
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
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
              {/* ── Header ── */}
              <thead>
                {/* Group row */}
                <tr className="bg-muted/70 text-muted-foreground">
                  <th
                    rowSpan={2}
                    className={cn("sticky start-0 z-30 bg-muted text-start", th, groupBorder)}
                  >
                    {t("evaluation.columns.store")}
                  </th>
                  {items.length > 0 && (
                    <th colSpan={items.length} className={cn("text-center", th, groupBorder)}>
                      <span className="inline-flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5" /> {t("evaluation.columns.inspectionItems")}
                      </span>
                    </th>
                  )}
                  <th
                    rowSpan={2}
                    className={cn("text-center leading-tight", th, groupBorder)}
                  >
                    {t("evaluation.columns.itemScore")}
                  </th>
                  <th colSpan={4} className={cn("text-center", th, groupBorder)}>
                    <span className="inline-flex items-center gap-1.5">
                      <SprayCan className="h-3.5 w-3.5" /> {t("evaluation.columns.cleaningChart")}
                    </span>
                  </th>
                  <th
                    rowSpan={2}
                    className={cn("text-center leading-tight", th, groupBorder)}
                  >
                    {t("evaluation.columns.chartScore")}
                  </th>
                  <th rowSpan={2} className={cn("text-center", th)}>
                    {t("evaluation.columns.notify")}
                  </th>
                </tr>
                {/* Sub-header row */}
                <tr className="bg-muted/40 text-muted-foreground">
                  {items.map((it) => (
                    <th
                      key={it.id}
                      className={cn(
                        "px-2 py-1.5 text-center text-[11px] font-medium normal-case",
                        groupBorder
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span className="max-w-[100px] truncate" title={it.name}>
                          {it.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget({ id: it.id, name: it.name })}
                          className="text-muted-foreground/50 transition-colors hover:text-destructive"
                          title={t("evaluation.removeItemTitle")}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    </th>
                  ))}
                  {CHART_GROUPS.map((g, idx) => (
                    <th
                      key={g.key}
                      className={cn(
                        "px-2 py-1.5 text-center text-[11px] font-medium normal-case",
                        idx === CHART_GROUPS.length - 1 && groupBorder
                      )}
                    >
                      {t(`frequency.${g.key}`)}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* ── Body ── */}
              <tbody>
                {grid.rows.map((row, rowIdx) => {
                  const finalizing = busy === `f-${row.storeId}`;
                  const unevaluated = isRowUnevaluated(row, items);
                  return (
                    <tr
                      key={row.storeId}
                      className="group border-t border-border/60 transition-colors hover:bg-muted/40"
                    >
                      {/* Store (sticky) — opaque bg that tracks the row hover */}
                      <td
                        className={cn(
                          "sticky start-0 z-10 whitespace-nowrap bg-card px-3 py-2 font-semibold transition-colors group-hover:bg-[color-mix(in_srgb,var(--muted)_40%,var(--card))]",
                          groupBorder
                        )}
                      >
                        {row.store}
                      </td>

                      {/* Inspection items — always open the Grade modal, never a quick toggle */}
                      {items.map((it) => {
                        const cell = row.itemValues[it.name] ?? EMPTY_CELL;
                        const savingKey = `i-${row.storeId}-${it.id}`;
                        const annotated = Boolean(cell.note) || cell.photos.length > 0;
                        return (
                          <td key={it.id} className={cn("p-1.5 text-center", groupBorder)}>
                            <div className="relative inline-flex">
                              <ValueBadge
                                value={cell.value}
                                disabled={busy === savingKey}
                                onClick={() =>
                                  setGradeTarget({
                                    storeId: row.storeId,
                                    store: row.store,
                                    itemId: it.id,
                                    itemName: it.name,
                                    cell,
                                  })
                                }
                              />
                              {/* Dot marks a cell that carries a note and/or photos. */}
                              {annotated && (
                                <span
                                  className="pointer-events-none absolute -end-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary"
                                  title={cell.note ?? undefined}
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Item score */}
                      <td className={cn("px-3 py-2 text-center", groupBorder)}>
                        <ScoreOrDash
                          pct={row.itemScore}
                          unevaluated={unevaluated}
                          className="text-sm"
                        />
                      </td>

                      {/* Chart groups */}
                      {CHART_GROUPS.map((g, idx) => (
                        <td
                          key={g.key}
                          className={cn(
                            "min-w-[120px] p-1.5 align-top",
                            idx === CHART_GROUPS.length - 1 && groupBorder
                          )}
                        >
                          {row.chart[g.key].length === 0 ? (
                            <div className="py-1 text-center text-xs text-muted-foreground/40">
                              —
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {row.chart[g.key].map((cell) => {
                                const savingKey = `c-${row.storeId}-${cell.taskId}`;
                                const accent = cell.verdict ? VERDICT_ACCENT[cell.verdict] : null;
                                return (
                                  <button
                                    key={cell.taskId}
                                    type="button"
                                    disabled={busy === savingKey}
                                    onClick={() => toggleChart(row.storeId, cell)}
                                    title={t("evaluation.cellWeightTitle", {
                                      name: cell.name,
                                      weight: cell.weight,
                                    })}
                                    className={cn(
                                      "flex w-full items-start gap-1.5 rounded-lg px-2 py-1 text-start transition-colors",
                                      accent
                                        ? "border bg-card hover:bg-muted/60"
                                        : "hover:bg-muted/40",
                                      busy === savingKey && "opacity-50"
                                    )}
                                  >
                                    {accent && (
                                      <span className={cn("mt-0.5 h-3 w-1 shrink-0 rounded-full", accent.bar)} />
                                    )}
                                    <span
                                      className={cn(
                                        "min-w-0 flex-1 break-words text-[11px] font-medium leading-snug",
                                        !accent && "text-muted-foreground"
                                      )}
                                    >
                                      {cell.name}
                                    </span>
                                    {accent && (
                                      <span
                                        className={cn(
                                          "mt-0.5 shrink-0 text-[10px] font-bold uppercase",
                                          accent.text
                                        )}
                                      >
                                        {VERDICT_SHORT[cell.verdict as ChartVerdict]}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      ))}

                      {/* Chart score */}
                      <td className={cn("px-3 py-2 text-center", groupBorder)}>
                        <ScoreOrDash
                          pct={row.chartScore}
                          unevaluated={unevaluated}
                          className="text-sm"
                        />
                      </td>

                      {/* Notify */}
                      <td className="px-3 py-2 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={finalizing}
                          onClick={() =>
                            guard(`f-${row.storeId}`, async () => {
                              await onFinalize(row.storeId);
                              toast.success(t("evaluation.toasts.notified", { store: row.store }));
                            })
                          }
                        >
                          {finalizing ? (
                            <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <BellRing className="me-1.5 h-4 w-4" />
                          )}
                          {t("evaluation.finalize")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
    </div>
  );
}
