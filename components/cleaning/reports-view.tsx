"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, ImageDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { cleaningService, CleaningError } from "@/lib/api/services/cleaning.service";
import {
  AccentBadge,
  ValueBadge,
  ScoreOrDash,
  cellBorder,
  headerCell,
  VALUE_ACCENT,
} from "./cleaning-ui";
import type {
  EvaluationGrid,
  InspectionItem,
  ItemValue,
  PeriodType,
} from "@/types/cleaning.types";

interface ReportRow {
  storeId: number;
  store: string;
  itemValues: Record<string, ItemValue>;
  itemScore: number;
  passCount: number;
  itemCount: number;
  chartCommitment: boolean;
  scorePct: number;
  /** No inspection items scored AND no chart verdicts set — nothing to report yet. */
  unevaluated: boolean;
}

/** Report Score = (# pass items + chart commitment) / (item count + 1). */
function buildRows(grid: EvaluationGrid): ReportRow[] {
  const itemCount = grid.items.length;
  const rows = grid.rows.map((row) => {
    const hasAnyItemValue = grid.items.some(
      (item) => (row.itemValues[item.name] ?? "empty") !== "empty"
    );
    const hasAnyChartVerdict = (["daily", "weekly", "monthly", "hourly"] as const).some((g) =>
      row.chart[g].some((c) => c.verdict != null)
    );
    const passCount = grid.items.reduce((acc, item) => {
      const v = (row.itemValues[item.name] ?? "empty") as ItemValue;
      return acc + (v === "pass" ? 1 : 0);
    }, 0);
    const chartCommitment = row.chartScore >= 100;
    const scorePct = Math.round(
      ((passCount + (chartCommitment ? 1 : 0)) / (itemCount + 1)) * 100
    );
    return {
      storeId: row.storeId,
      store: row.store,
      itemValues: row.itemValues ?? {},
      itemScore: row.itemScore ?? 0,
      passCount,
      itemCount,
      chartCommitment,
      scorePct,
      unevaluated: !hasAnyItemValue && !hasAnyChartVerdict,
    };
  });
  // Order by score, highest first; tie-break by store name.
  return rows.sort((a, b) => b.scorePct - a.scorePct || a.store.localeCompare(b.store));
}

/* ── Presentational bits ── */

/** Green only when passing (≥80%) — nothing is coloured red; low scores stay neutral. */
function scoreTone(pct: number) {
  return pct >= 80 ? "bg-emerald-500 dark:bg-emerald-400" : "bg-zinc-400 dark:bg-zinc-500";
}

function ScoreBar({ pct, unevaluated }: { pct: number; unevaluated?: boolean }) {
  if (unevaluated) {
    return <span className="text-sm text-muted-foreground/40">--</span>;
  }
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", scoreTone(p))} style={{ width: `${p}%` }} />
      </div>
      <span className="w-9 shrink-0 text-end text-xs font-bold tabular-nums">{p}%</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1
      ? "bg-amber-400/20 text-amber-600 dark:text-amber-400"
      : rank === 2
        ? "bg-zinc-400/20 text-zinc-600 dark:text-zinc-300"
        : rank === 3
          ? "bg-orange-500/20 text-orange-600 dark:text-orange-400"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums",
        medal
      )}
    >
      {rank}
    </span>
  );
}

/** The single consolidated table — used on screen and in the export image. */
function ReportTable({
  items,
  rows,
}: {
  items: InspectionItem[];
  rows: ReportRow[];
}) {
  const t = useTranslations("cleaningChart.reports");
  const evaluatedRows = rows.filter((r) => !r.unevaluated);
  const avg = evaluatedRows.length
    ? Math.round(evaluatedRows.reduce((a, r) => a + r.scorePct, 0) / evaluatedRows.length)
    : 0;

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/70 text-muted-foreground">
              <th rowSpan={2} className={cn("text-center", headerCell, cellBorder)}>
                {t("table.rank")}
              </th>
              <th rowSpan={2} className={cn("text-start", headerCell, cellBorder)}>
                {t("table.store")}
              </th>
              {items.length > 0 && (
                <th colSpan={items.length} className={cn("text-center", headerCell, cellBorder)}>
                  {t("table.inspectionItems")}
                </th>
              )}
              <th
                rowSpan={2}
                className={cn("text-center leading-tight", headerCell, cellBorder)}
              >
                {t("table.itemScore")}
              </th>
              <th rowSpan={2} className={cn("text-center", headerCell, cellBorder)}>
                {t("table.chart")}
              </th>
              <th rowSpan={2} className={cn("text-start", headerCell)}>
                {t("table.score")}
              </th>
            </tr>
            {items.length > 0 && (
              <tr className="bg-muted/40 text-muted-foreground">
                {items.map((it) => (
                  <th
                    key={it.id}
                    className={cn(
                      "px-2 py-1.5 text-center text-[11px] font-medium normal-case",
                      cellBorder
                    )}
                    title={it.name}
                  >
                    <span className="block max-w-[90px] truncate">{it.name}</span>
                  </th>
                ))}
              </tr>
            )}
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4 + items.length}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  {t("table.empty")}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={r.storeId}
                  className="group border-t border-border/60 transition-colors hover:bg-muted/40"
                >
                  <td className={cn("text-center", "px-3 py-2", cellBorder)}>
                    <RankBadge rank={i + 1} />
                  </td>
                  <td className={cn("whitespace-nowrap px-3 py-2 font-semibold", cellBorder)}>
                    {r.store}
                  </td>
                  {items.map((it) => {
                    const v = (r.itemValues[it.name] ?? "empty") as ItemValue;
                    return (
                      <td key={it.id} className={cn("px-2 py-2 text-center", cellBorder)}>
                        {v === "empty" ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : (
                          <ValueBadge value={v} />
                        )}
                      </td>
                    );
                  })}
                  <td className={cn("px-3 py-2 text-center", cellBorder)}>
                    <ScoreOrDash pct={r.itemScore} unevaluated={r.unevaluated} className="text-sm" />
                  </td>
                  <td className={cn("px-3 py-2 text-center", cellBorder)}>
                    {r.unevaluated ? (
                      <span className="text-sm text-muted-foreground/40">--</span>
                    ) : (
                      <AccentBadge
                        accent={r.chartCommitment ? VALUE_ACCENT.pass : VALUE_ACCENT.fail}
                        label={r.chartCommitment ? t("table.pass") : t("table.fail")}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <ScoreBar pct={r.scorePct} unevaluated={r.unevaluated} />
                  </td>
                </tr>
              ))
            )}
            {rows.length > 0 && (
              <tr className="border-t-2 bg-muted/50 font-semibold">
                <td className={cellBorder} />
                <td className={cn("px-3 py-2", cellBorder)}>{t("table.average")}</td>
                {items.length > 0 && <td colSpan={items.length} className={cellBorder} />}
                <td className={cellBorder} />
                <td className={cellBorder} />
                <td className="px-3 py-2">
                  <ScoreBar pct={avg} unevaluated={evaluatedRows.length === 0} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReportsView({
  grid,
  periodType,
  periodKey,
}: {
  grid: EvaluationGrid;
  periodType: PeriodType;
  periodKey: string;
}) {
  const t = useTranslations("cleaningChart.reports");
  const items = grid.items;
  const rows = useMemo(() => buildRows(grid), [grid]);
  const boardRef = useRef<HTMLDivElement>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  const downloadPng = async () => {
    if (!boardRef.current) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const bg = getComputedStyle(boardRef.current).backgroundColor || "#ffffff";
      const dataUrl = await toPng(boardRef.current, {
        pixelRatio: 2,
        backgroundColor: bg,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `cleaning-report-${periodKey}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(t("toasts.imageDownloaded"));
      setReviewOpen(false);
    } catch (err) {
      console.error("PNG export failed:", err);
      toast.error(t("toasts.imageFailed"));
    } finally {
      setExporting(false);
    }
  };

  const downloadCsv = async () => {
    setDownloadingCsv(true);
    try {
      const blob = await cleaningService.downloadCsv(periodType, periodKey);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `cleaning-report-${periodKey}.csv`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("toasts.csvFailed"));
    } finally {
      setDownloadingCsv(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Actions row — flat toolbar, matches the app pattern */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("periodLabel", { period: periodKey })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={downloadCsv} disabled={downloadingCsv}>
              {downloadingCsv ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="me-2 h-4 w-4" />
              )}
              {t("csv")}
            </Button>
            <Button onClick={() => setReviewOpen(true)}>
              <ImageDown className="me-2 h-4 w-4" />
              {t("exportPng")}
            </Button>
          </div>
        </div>

        <ReportTable items={items} rows={rows} />
      </div>

      {/* Review-before-export: the single consolidated table */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[92vh] max-w-[95vw] gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{t("reviewDialog.title")}</DialogTitle>
            <DialogDescription>{t("reviewDialog.description")}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[72vh] overflow-auto bg-muted/20 p-4">
            <div ref={boardRef} className="w-max min-w-full bg-card p-5">
              <div className="mb-4">
                <h3 className="font-heading text-lg font-semibold">{t("title")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("periodLabel", { period: periodKey })}
                </p>
              </div>
              <ReportTable items={items} rows={rows} />
            </div>
          </div>

          <DialogFooter className="gap-2 border-t px-4 py-3 sm:px-6 sm:py-4">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setReviewOpen(false)}
              disabled={exporting}
            >
              {t("reviewDialog.cancel")}
            </Button>
            <Button className="w-full sm:w-auto" onClick={downloadPng} disabled={exporting}>
              {exporting ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <ImageDown className="me-2 h-4 w-4" />
              )}
              {t("downloadPng")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
