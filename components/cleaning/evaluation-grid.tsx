"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  BellRing,
  CalendarRange,
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

const ITEM_CYCLE: ItemValue[] = ["pass", "fail", "auto_fail", "empty"];
const CHART_GROUPS: {
  key: keyof Grid["rows"][number]["chart"];
  label: string;
}[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "hourly", label: "Hourly" },
];

const LEGEND: { value: ItemValue; label: string }[] = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "auto_fail", label: "Auto" },
  { value: "empty", label: "Empty" },
];

const VERDICT_SHORT: Record<ChartVerdict, string> = {
  pass: "P",
  fail: "F",
  auto_fail: "A",
};

/** True once at least one inspection item on this row has been scored. */
function hasAnyItemValue(row: EvalRow, items: InspectionItem[]): boolean {
  return items.some((it) => (row.itemValues[it.name] ?? "empty") !== "empty");
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
    value: ItemValue
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
  const [type, setType] = useState<PeriodType>(periodType);
  const [keyInput, setKeyInput] = useState(periodKey);
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
      toast.error(err instanceof CleaningError ? err.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  };

  const cycleItem = (storeId: number, itemId: number, name: string, current: ItemValue) => {
    const next = ITEM_CYCLE[(ITEM_CYCLE.indexOf(current) + 1) % ITEM_CYCLE.length];
    void guard(`i-${storeId}-${itemId}`, () => onSetItemCell(storeId, itemId, name, next));
  };

  const toggleChart = (storeId: number, cell: ChartCell) => {
    const next: ChartVerdict = cell.verdict === "pass" ? "fail" : "pass";
    void guard(`c-${storeId}-${cell.taskId}`, () => onSetChartCell(storeId, cell.taskId, next));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Actions row — flat toolbar, matches the app pattern ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border bg-muted/40 p-1">
            {(["week", "date"] as PeriodType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                  type === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="relative">
            <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && keyInput.trim()) {
                  onLoadPeriod(type, keyInput.trim());
                }
              }}
              placeholder={type === "week" ? "2026-W30" : "2026-07-21"}
              className="h-9 w-40 ps-9"
            />
          </div>
          <Button variant="outline" onClick={() => onLoadPeriod(type, keyInput.trim())}>
            Load
          </Button>
        </div>

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
            placeholder="Add inspection item…"
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
            Add
          </Button>
        </div>
      </div>

      {/* Legend + hint */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
          Legend
        </span>
        {LEGEND.map((l) => (
          <span key={l.value} className="flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("h-3 w-1 rounded-full", VALUE_ACCENT[l.value].bar)} />
            {l.label}
          </span>
        ))}
        <span className="ms-auto hidden text-muted-foreground/80 md:block">
          Click a cell to cycle · click a chart chip to toggle Pass/Fail
        </span>
      </div>

      {/* ── The grid ── */}
      {grid.rows.length === 0 ? (
        <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
          No stores to evaluate for this period.
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
                    className={cn("sticky left-0 z-30 bg-muted text-left", th, groupBorder)}
                  >
                    Store
                  </th>
                  {items.length > 0 && (
                    <th colSpan={items.length} className={cn("text-center", th, groupBorder)}>
                      <span className="inline-flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5" /> Inspection Items
                      </span>
                    </th>
                  )}
                  <th
                    rowSpan={2}
                    className={cn("text-center leading-tight", th, groupBorder)}
                  >
                    Item
                    <br />
                    Score
                  </th>
                  <th colSpan={4} className={cn("text-center", th, groupBorder)}>
                    <span className="inline-flex items-center gap-1.5">
                      <SprayCan className="h-3.5 w-3.5" /> Cleaning Chart
                    </span>
                  </th>
                  <th
                    rowSpan={2}
                    className={cn("text-center leading-tight", th, groupBorder)}
                  >
                    Chart
                    <br />
                    Score
                  </th>
                  <th rowSpan={2} className={cn("text-center", th)}>
                    Notify
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
                          title="Remove item"
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
                      {g.label}
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
                          "sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-2 font-semibold transition-colors group-hover:bg-[color-mix(in_srgb,var(--muted)_40%,var(--card))]",
                          groupBorder
                        )}
                      >
                        {row.store}
                      </td>

                      {/* Inspection items */}
                      {items.map((it) => {
                        const value = (row.itemValues[it.name] ?? "empty") as ItemValue;
                        const savingKey = `i-${row.storeId}-${it.id}`;
                        return (
                          <td key={it.id} className={cn("p-1.5 text-center", groupBorder)}>
                            <ValueBadge
                              value={value}
                              disabled={busy === savingKey}
                              onClick={() => cycleItem(row.storeId, it.id, it.name, value)}
                            />
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
                                    title={`${cell.name} (weight ${cell.weight})`}
                                    className={cn(
                                      "flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors",
                                      accent
                                        ? "border bg-card hover:bg-muted/60"
                                        : "hover:bg-muted/40",
                                      busy === savingKey && "opacity-50"
                                    )}
                                  >
                                    {accent && (
                                      <span className={cn("h-3 w-1 shrink-0 rounded-full", accent.bar)} />
                                    )}
                                    <span
                                      className={cn(
                                        "min-w-0 flex-1 truncate text-[11px] font-medium",
                                        !accent && "text-muted-foreground"
                                      )}
                                    >
                                      {cell.name}
                                    </span>
                                    {accent && (
                                      <span
                                        className={cn(
                                          "shrink-0 text-[10px] font-bold uppercase",
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
                              toast.success(`${row.store} notified.`);
                            })
                          }
                        >
                          {finalizing ? (
                            <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <BellRing className="me-1.5 h-4 w-4" />
                          )}
                          Finalize
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
          No inspection items yet — add one above to start grading.
        </p>
      )}

      {/* Confirm remove inspection item */}
      <AlertDialog
        open={removeTarget != null}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove inspection item?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the “{removeTarget?.name}” column and its recorded values
              for all stores in this period. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy?.startsWith("rm-")}>
              Cancel
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
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
