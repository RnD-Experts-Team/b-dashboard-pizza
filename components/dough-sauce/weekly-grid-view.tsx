"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { useDoughSauceAccess } from "@/lib/hooks/use-dough-sauce-access";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ImageDown,
  LayoutList,
  Loader2,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DoughSauceError } from "@/lib/api/services/dough-sauce.service";
import { useIngredients, useWeeklyGrid, type JudgementPatch, type StoreWeekResult } from "@/lib/hooks/use-dough-sauce";
import { CELLS_PER_WEEK, WEIGHTS } from "@/lib/dough-sauce/formulas";
import { todayIso } from "@/lib/dough-sauce/dates";
import type { JudgementPayload, QualityVerdict, StickersVerdict } from "@/types/dough-sauce.types";
import {
  DsErrorState,
  WeekPicker,
  exportNodeAsPng,
  fmtPct,
  fmtSignedPct,
  personName,
  useDayFormatter,
  useStoreNames,
  useSystemLabel,
} from "./ds-ui";
import { WeekCellsGrid } from "./week-cells-grid";
const UNSET = "unset";
type WeekFilter = "all" | "judgement" | "missing";

/** §8.3 — weekly grid, report and ranking. The specialist's only write is the judgement. */
export function WeeklyGridView() {
  const t = useTranslations("doughSauce.weekly");
  const tc = useTranslations("doughSauce.common");
  const tr = useTranslations("doughSauce.report");
  const locale = useLocale();
  const systemLabel = useSystemLabel();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The week is kept in the URL so the full report's Back button can return to it.
  const [weekStart, setWeekStartState] = useState<string | undefined>(searchParams.get("week") ?? undefined);
  const setWeekStart = (w: string) => {
    setWeekStartState(w);
    const q = new URLSearchParams(searchParams.toString());
    q.set("tab", "weekly");
    q.set("week", w);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const { ingredients, map, loaded } = useIngredients();
  const {
    weekly,
    error,
    results,
    loading,
    countsLoading,
    countsSummary,
    countsError,
    loadCounts,
    saveJudgement,
    reload,
  } = useWeeklyGrid(weekStart, map, loaded);
  const allScored = countsSummary.allReady;

  const selectedWeek = weekStart ?? weekly?.week.week_start;
  const [filter, setFilter] = useState<WeekFilter>("all");
  const [query, setQuery] = useState("");
  const storeNames = useStoreNames();
  const day = useDayFormatter();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return results.filter((r) => {
      if (filter === "judgement" && r.judgement?.complete) return false;
      if (filter === "missing" && !(r.cells.missingCount > 0 || r.countsUnavailable)) return false;
      if (!q) return true;
      return r.store.toLowerCase().includes(q) || (storeNames.get(r.store) ?? "").toLowerCase().includes(q);
    });
  }, [results, filter, query, storeNames]);

  const counts = useMemo(
    () => ({
      all: results.length,
      judgement: results.filter((r) => !r.judgement?.complete).length,
      missing: results.filter((r) => r.cells.missingCount > 0 || r.countsUnavailable).length,
    }),
    [results]
  );

  const onExport = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      await exportNodeAsPng(reportRef.current, `dough-sauce-week-${selectedWeek}.png`);
      toast.success(t("imageDownloaded"));
    } catch {
      toast.error(t("imageFailed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WeekPicker
          weeks={weekly?.weeks ?? []}
          value={selectedWeek}
          onChange={(w) => {
            setWeekStart(w);
            setExpanded(null);
          }}
          disabled={loading}
        />
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" disabled={!selectedWeek}>
            <Link href={`/${locale}/dashboard/dough-sauce/report${selectedWeek ? `?week=${selectedWeek}` : ""}`}>
              <LayoutList className="me-2 h-4 w-4" />
              {tr("openFull")}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={exporting || !weekly || !allScored}
            title={allScored ? undefined : t("exportNeedsScores")}
          >
            {exporting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ImageDown className="me-2 h-4 w-4" />}
            {t("exportImage")}
          </Button>
          <Button variant="outline" size="icon" onClick={reload} disabled={loading} aria-label={tc("refresh")}>
            <RefreshCw className={cn("h-4 w-4", (loading || countsLoading) && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error && !weekly && <DsErrorState error={error} onRetry={reload} />}
      {loading && !weekly && !error && <Skeleton className="h-96 w-full" />}

      {weekly && (
        <>
          {weekly.week.week_end >= todayIso() && (
            <p className="text-xs text-muted-foreground">{t("weekInProgress")}</p>
          )}

          {countsLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("loadingCounts")}
            </p>
          ) : (
            countsSummary.storesWithoutCounts != null &&
            countsSummary.storesWithoutCounts > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("noCountsAtAll", { n: countsSummary.storesWithoutCounts })}
              </p>
            )
          )}
          {countsError && (
            <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {countsError.code === "FORBIDDEN"
                  ? t("countsForbidden")
                  : t("countsUnavailable", { system: systemLabel("inv"), message: countsError.message })}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex w-full gap-1 rounded-lg border bg-muted/40 p-1 sm:w-auto">
              {(["all", "judgement", "missing"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
                    filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t(`filter.${f}`)}
                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{counts[f]}</span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} className="ps-8" />
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <p className="text-sm text-muted-foreground">{results.length === 0 ? t("empty") : t("emptyFiltered")}</p>
            </div>
          ) : (
            <Card ref={reportRef} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="border-b px-4 py-3">
                  <p className="font-heading text-base font-semibold">
                    {t("reportTitle", {
                      week: weekly.week.label ?? tc("weekLabel", { week: weekly.week.week_no, year: weekly.week.fiscal_year }),
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {day.short(weekly.week.week_start)} → {day.short(weekly.week.week_end)} · {t("formula")}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="w-8 p-2" />
                        <th className="p-2 text-start">{t("colRank")}</th>
                        <th className="p-2 text-start">{t("colStore")}</th>
                        <th className="p-2 text-end">{t("colDays")}</th>
                        <th className="p-2 text-end">{t("colCells")}</th>
                        <th className="p-2 text-start">{t("colStickers")}</th>
                        <th className="p-2 text-start">{t("colQuality")}</th>
                        <th className="p-2 text-end">{t("colScore")}</th>
                        <th className="p-2 text-end">{t("colProgress")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r) => (
                        <Fragment key={r.store}>
                          <StoreRow
                            row={r}
                            storeName={storeNames.get(r.store)}
                            weekStart={weekly.week.week_start}
                            expanded={expanded === r.store}
                            onToggle={() => {
                              const opening = expanded !== r.store;
                              setExpanded(opening ? r.store : null);
                              if (opening && r.needsCounts) void loadCounts(r.store);
                            }}
                            onSave={saveJudgement}
                          />
                          {expanded === r.store && (
                            <tr className="border-t bg-muted/20">
                              <td colSpan={9} className="p-3 sm:p-4">
                                <div className="grid gap-x-6 gap-y-5 lg:grid-cols-[1fr_280px]">
                                  <div className="min-w-0">
                                    {!r.needsCounts || r.countsStatus === "ready" || r.countsStatus === "error" ? (
                                      <>
                                        <WeekCellsGrid cells={r.cells} ingredients={ingredients} />
                                        {r.countsStatus === "error" && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="mt-3"
                                            onClick={() => void loadCounts(r.store)}
                                          >
                                            <RefreshCw className="me-2 h-3.5 w-3.5" />
                                            {t("retryCounts")}
                                          </Button>
                                        )}
                                      </>
                                    ) : (
                                      <div className="space-y-2">
                                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          {t("loadingCounts")}
                                        </p>
                                        <Skeleton className="h-44 w-full" />
                                      </div>
                                    )}
                                  </div>
                                  <JudgementNote row={r} weekStart={weekly.week.week_start} onSave={saveJudgement} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export type SaveJudgement = (storeKey: string, patch: JudgementPatch) => Promise<unknown>;

export function useJudgementSaver(row: StoreWeekResult, weekStart: string, onSave: SaveJudgement) {
  const t = useTranslations("doughSauce.weekly");
  const [saving, setSaving] = useState(false);
  // The Specialist's write (#5). Without the PUT rule the controls render read-only.
  const canJudge = useDoughSauceAccess().can.judge(row.storeId);
  const save = async (patch: Partial<JudgementPayload>) => {
    if (!canJudge) return;
    setSaving(true);
    try {
      // week_start comes from the server's week object — never derived (rule 1).
      // Only the changed fields go up; the hook merges them onto the latest judgement.
      await onSave(row.store, { week_start: weekStart, ...patch });
      toast.success(t("judgementSaved", { store: row.store }));
    } catch (err) {
      toast.error(err instanceof DoughSauceError ? err.message : t("judgementFailed"));
    } finally {
      setSaving(false);
    }
  };
  return { saving, save, canJudge };
}

function StoreRow({
  row,
  storeName,
  weekStart,
  expanded,
  onToggle,
  onSave,
}: {
  row: StoreWeekResult;
  storeName?: string;
  weekStart: string;
  expanded: boolean;
  onToggle: () => void;
  onSave: SaveJudgement;
}) {
  const t = useTranslations("doughSauce.weekly");
  const { saving, save, canJudge } = useJudgementSaver(row, weekStart, onSave);
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const pending = !row.judgement?.complete;

  return (
    <tr className={cn("border-t transition-colors hover:bg-muted/30", expanded && "bg-muted/20")}>
      <td className="p-2">
        <button
          type="button"
          onClick={onToggle}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          aria-expanded={expanded}
          aria-label={t("toggleDetails", { store: row.store })}
        >
          <Chevron className={cn("h-4 w-4", !expanded && "rtl:-scale-x-100")} />
        </button>
      </td>
      <td className="p-2">
        {row.inactive || row.rank === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span
            className={cn(
              "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
              row.rank <= 3 ? "bg-muted text-foreground" : "text-muted-foreground"
            )}
          >
            {row.rank}
          </span>
        )}
      </td>
      <td className="p-2">
        <button type="button" onClick={onToggle} className="text-start">
          <span className="block font-medium">{storeName ?? row.store}</span>
          {storeName && <span className="block text-xs text-muted-foreground tabular-nums">{row.store}</span>}
        </button>
      </td>
      <td className={cn("p-2 text-end tabular-nums", row.daysConfirmed === 0 && "text-muted-foreground")}>
        {row.daysConfirmed}/{row.cells.days.length}
      </td>
      <td className="p-2 text-end tabular-nums">
        {row.countsStatus === "loading" ? (
          <Loader2 className="ms-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : !row.needsCounts ? (
          <span className="text-muted-foreground">0/{CELLS_PER_WEEK}</span>
        ) : row.countsStatus === "idle" ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : row.countsUnavailable ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            {t("countsNA")}
          </span>
        ) : (
          <span className={cn(!row.cells.hasPlans && "text-muted-foreground")}>
            {row.cells.cellsOk}/{CELLS_PER_WEEK}
            {row.cells.missingCount > 0 && (
              <span className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                {t("missingCells", { n: row.cells.missingCount })}
              </span>
            )}
            {row.cells.awaitingCount > 0 && (
              <span className="block text-[10px] text-muted-foreground">
                {t("awaitingCells", { n: row.cells.awaitingCount })}
              </span>
            )}
          </span>
        )}
      </td>
      <td className="p-2">
        <Select
          value={row.judgement?.stickers_compliance ?? UNSET}
          onValueChange={(v) => save({ stickers_compliance: v === UNSET ? null : (v as StickersVerdict) })}
          disabled={saving || !canJudge}
        >
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>{t("verdictUnset")}</SelectItem>
            <SelectItem value="yes">{t("stickersYes")}</SelectItem>
            <SelectItem value="no">{t("stickersNo")}</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="p-2">
        <Select
          value={row.judgement?.dough_quality ?? UNSET}
          onValueChange={(v) => save({ dough_quality: v === UNSET ? null : (v as QualityVerdict) })}
          disabled={saving || !canJudge}
        >
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>{t("verdictUnset")}</SelectItem>
            <SelectItem value="pass">{t("qualityPass")}</SelectItem>
            <SelectItem value="fail">{t("qualityFail")}</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="p-2 text-end">
        {row.inactive ? (
          <span className="text-xs text-muted-foreground">{t("notStarted")}</span>
        ) : !row.scored ? (
          row.countsStatus === "error" ? (
            <button
              type="button"
              onClick={onToggle}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {t("openToScore")}
            </button>
          ) : (
            <Loader2 className="ms-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )
        ) : (
          <>
            <span className="text-base font-semibold tabular-nums">{fmtPct(row.breakdown.score)}</span>
            {/* Neutral on purpose: the rank already orders stores, colour is kept for what needs action. */}
            <span className="ms-auto mt-1 block h-1 w-20 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-foreground/60 transition-[width] duration-500"
                style={{ width: `${Math.min(100, row.breakdown.score * 100)}%` }}
              />
            </span>
            {pending && <span className="mt-0.5 block text-[10px] text-muted-foreground">{t("judgementPending")}</span>}
          </>
        )}
      </td>
      <td className="p-2 text-end tabular-nums">
        {row.inactive || row.progress == null ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : Math.abs(row.progress) < 0.0005 ? (
          <span className="text-xs text-muted-foreground">{fmtSignedPct(0)}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm">
            {row.progress > 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {fmtSignedPct(row.progress)}
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * The whole score as one bar, each component as wide as its weight: the filled part is what was
 * earned, the empty track what was lost. Neutral ink only. The lines below carry the numbers.
 */
function BreakdownBar({ parts }: { parts: { part: number; max: number; unknown?: boolean }[] }) {
  return (
    <div className="flex h-1.5 gap-0.5" aria-hidden>
      {parts.map((p, i) => (
        <div key={i} className="relative overflow-hidden rounded-full bg-muted" style={{ flexGrow: p.max, flexBasis: 0 }}>
          {!p.unknown && (
            <div
              className="absolute inset-y-0 start-0 rounded-full bg-foreground/70 transition-[width] duration-500"
              style={{ width: `${Math.min(100, (p.part / p.max) * 100)}%` }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/** One weighted component of the score: what it earned, out of what it could earn. */
function BreakdownLine({ label, part, max, unknown }: { label: string; part: number; max: number; unknown?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 tabular-nums">
      <dt className="min-w-0 truncate text-muted-foreground">{label}</dt>
      <dd className="shrink-0">
        <span className={cn("font-medium", !unknown && part === 0 && "text-muted-foreground")}>
          {unknown ? "\u2013" : fmtPct(part)}
        </span>
        <span className="text-muted-foreground/70"> / {fmtPct(max)}</span>
      </dd>
    </div>
  );
}

export function JudgementNote({ row, weekStart, onSave }: { row: StoreWeekResult; weekStart: string; onSave: SaveJudgement }) {
  const t = useTranslations("doughSauce.weekly");
  const [note, setNote] = useState(row.judgement?.note ?? "");
  const { saving, save, canJudge } = useJudgementSaver(row, weekStart, onSave);
  const b = row.breakdown;
  const dirty = (note.trim() || null) !== (row.judgement?.note ?? null);

  // Two grid items, not one block: the breakdown sits beside the matrix, and the note runs full width
  // underneath both, so neither column is left with a hole under it.
  return (
    <>
      <section className="text-sm lg:border-s lg:ps-6">
        {/* Result first, then why: the total heads the panel and the bar + lines explain it. */}
        <div className="flex items-baseline justify-between gap-3 tabular-nums">
          <h4 className="text-xs font-medium text-muted-foreground">{t("breakdown")}</h4>
          <span className="font-heading text-2xl font-semibold leading-none">
            {row.scored ? fmtPct(b.score) : "–"}
          </span>
        </div>
        <div className="mt-3">
          <BreakdownBar
            parts={[
              { part: b.variancePart, max: WEIGHTS.variance, unknown: !row.scored },
              { part: b.stickersPart, max: WEIGHTS.stickers },
              { part: b.qualityPart, max: WEIGHTS.quality },
            ]}
          />
        </div>
        <dl className="mt-2 divide-y">
          <BreakdownLine
            label={
              row.scored
                ? t("breakdownVariance", { ok: row.cells.cellsOk, total: CELLS_PER_WEEK })
                : t("breakdownVarianceUnknown")
            }
            part={b.variancePart}
            max={WEIGHTS.variance}
            unknown={!row.scored}
          />
          <BreakdownLine label={t("breakdownStickers")} part={b.stickersPart} max={WEIGHTS.stickers} />
          <BreakdownLine label={t("breakdownQuality")} part={b.qualityPart} max={WEIGHTS.quality} />
        </dl>
        {(row.previousScores.length > 0 || personName(row.judgement?.judged_by)) && (
          <div className="mt-2 space-y-0.5 border-t pt-3 text-xs text-muted-foreground tabular-nums">
            {row.previousScores.length > 0 && (
              <p>
                {t("previousScores", {
                  scores: row.previousScores.map((s) => (s == null ? "\u2013" : fmtPct(s))).join(", "),
                })}
              </p>
            )}
            {personName(row.judgement?.judged_by) && (
              <p>{t("judgedBy", { name: personName(row.judgement?.judged_by)! })}</p>
            )}
          </div>
        )}
      </section>

      <div className="space-y-2 border-t pt-4 lg:col-span-2">
        <p className="text-xs font-medium text-muted-foreground">{t("note")}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="min-h-0 flex-1 text-sm"
            disabled={!canJudge}
          />
          <Button
            size="sm"
            variant={dirty ? "default" : "outline"}
            className="sm:shrink-0"
            onClick={() => save({ note: note.trim() || null })}
            disabled={saving || !canJudge || !dirty}
          >
            {saving && <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />}
            {t("saveNote")}
          </Button>
        </div>
      </div>
    </>
  );
}
