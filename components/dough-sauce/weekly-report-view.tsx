"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  EyeOff,
  ImageDown,
  Loader2,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useIngredients, useWeeklyGrid, type StoreWeekResult } from "@/lib/hooks/use-dough-sauce";
import { todayIso } from "@/lib/dough-sauce/dates";
import type { WeekCell } from "@/lib/dough-sauce/week-cells";
import {
  INGREDIENT_KEYS,
  type IngredientKey,
  type QualityVerdict,
  type StickersVerdict,
} from "@/types/dough-sauce.types";
import {
  DsErrorState,
  WeekPicker,
  exportNodeAsPng,
  fmtPct,
  fmtQty,
  fmtSignedPct,
  useDayFormatter,
  useIngredientLabel,
  useStoreNames,
  useSystemLabel,
} from "./ds-ui";
import { WeekCellsGrid } from "./week-cells-grid";
import { ColorfulReportSheet } from "./weekly-report-sheet";
import { JudgementNote, useJudgementSaver, type SaveJudgement } from "./weekly-grid-view";

const UNSET = "unset";
/**
 * Ideal column widths. They are used as proportions: the table fills its card and may shrink
 * to SHRINK of this total before it scrolls sideways, so a card a few pixels narrower than the
 * table never leaves the last column cut off.
 */
const W = { store: 124, plan: 46, cell: 36, stk: 46, dq: 48, score: 52, prev: 40, progress: 54 } as const;
const SHRINK = 0.95;
const NO_DAYS: ReadonlySet<string> = new Set();

const toneBg = (score: number) =>
  score >= 0.8
    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
    : score >= 0.6
      ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
      : "bg-rose-500/20 text-rose-700 dark:text-rose-400";

/**
 * The weekly report on its own page: one row per store, every day × ingredient
 * visible at once. Headers are abbreviated (tooltips + a legend spell them out)
 * so the table fits without sideways scrolling.
 */
export function WeeklyReportView() {
  const t = useTranslations("doughSauce.report");
  const tw = useTranslations("doughSauce.weekly");
  const tc = useTranslations("doughSauce.common");
  const locale = useLocale();
  const systemLabel = useSystemLabel();
  const params = useSearchParams();
  const [weekStart, setWeekStart] = useState<string | undefined>(params.get("week") ?? undefined);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // The colourful sheet only exists in the DOM (off-screen) while it is being exported.
  const [sheetOpen, setSheetOpen] = useState(false);
  const { ingredients, map, loaded } = useIngredients();
  const labelOf = useIngredientLabel(ingredients);
  const storeNames = useStoreNames();
  const day = useDayFormatter();
  const { weekly, error, results, loading, countsLoading, countsSummary, countsError, loadCounts, saveJudgement, reload } =
    useWeeklyGrid(weekStart, map, loaded);

  const selectedWeek = weekStart ?? weekly?.week.week_start;
  const allScored = countsSummary.allReady;
  const previous = (weekly?.previous_weeks ?? []).slice(0, 3).map((p) => p.week_no);
  const days = results[0]?.cells.days ?? [];

  // Days the specialist removed from the report. View only: scores and the x/7 plan count still use the whole week.
  const [removedDays, setRemovedDays] = useState<ReadonlySet<string>>(new Set());
  const dataDays = useMemo(() => {
    const s = new Set<string>();
    for (const r of results) for (const c of r.cells.cells) if (c.kind === "counted" || c.kind === "missing") s.add(c.date);
    return s;
  }, [results]);
  // Only a day with nothing recorded for any store can go, and only once every store's counts are in
  // (before that a day can look empty just because its counts haven't loaded).
  const removable = useMemo(
    () => new Set(allScored ? days.filter((d) => !dataDays.has(d)) : []),
    [allScored, days, dataDays]
  );
  // A removed day that later gains data comes back by itself.
  const removedList = days.filter((d) => removedDays.has(d) && !dataDays.has(d));
  const shownDays = days.filter((d) => !removedList.includes(d));

  // store · plan · 3 per day · stk · dq · score · previous weeks · progress
  const colCount = 2 + shownDays.length * 3 + 2 + 1 + previous.length + 1;
  const tableTotal = tableWidth(shownDays.length, previous.length);
  const pct = (w: number) => `${(w / tableTotal) * 100}%`;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return results;
    return results.filter(
      (r) => r.store.toLowerCase().includes(q) || (storeNames.get(r.store) ?? "").toLowerCase().includes(q)
    );
  }, [results, query, storeNames]);

  const onExport = async (style: "colorful" | "current") => {
    setExporting(true);
    try {
      if (style === "colorful") {
        setSheetOpen(true);
        // let React mount the off-screen sheet before it is captured
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        if (!sheetRef.current) throw new Error("sheet");
        await exportNodeAsPng(sheetRef.current, `dough-sauce-report-${selectedWeek}-colorful.png`);
      } else {
        const card = reportRef.current;
        const scroller = scrollRef.current;
        if (!card) return;
        // The table can be wider than the card (it scrolls sideways on screen). A picture of the
        // card would cut off the last columns, so open it to the table's full width while capturing.
        const prevWidth = card.style.width;
        const prevOverflow = scroller?.style.overflow ?? "";
        if (scroller) {
          card.style.width = `${scroller.scrollWidth}px`;
          scroller.style.overflow = "visible";
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        }
        try {
          await exportNodeAsPng(card, `dough-sauce-report-${selectedWeek}.png`);
        } finally {
          card.style.width = prevWidth;
          if (scroller) scroller.style.overflow = prevOverflow;
        }
      }
      toast.success(tw("imageDownloaded"));
    } catch {
      toast.error(tw("imageFailed"));
    } finally {
      setSheetOpen(false);
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/dashboard/dough-sauce?tab=weekly${selectedWeek ? `&week=${selectedWeek}` : ""}`}>
              <ArrowLeft className="me-1.5 h-4 w-4 rtl:rotate-180" />
              {t("back")}
            </Link>
          </Button>
          <WeekPicker
            weeks={weekly?.weeks ?? []}
            value={selectedWeek}
            onChange={(w) => {
              setWeekStart(w);
              setExpanded(null);
              setRemovedDays(new Set());
            }}
            disabled={loading}
          />
          <div className="relative w-full sm:w-52">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tw("searchPlaceholder")} className="ps-8" />
          </div>
          {removedList.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <EyeOff className="me-1.5 h-4 w-4" />
                  {t("hiddenDays", { n: removedList.length })}
                  <ChevronDown className="ms-1.5 h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {removedList.map((d) => (
                  <DropdownMenuItem
                    key={d}
                    onSelect={() =>
                      setRemovedDays((s) => {
                        const next = new Set(s);
                        next.delete(d);
                        return next;
                      })
                    }
                  >
                    {day.short(d)}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setRemovedDays(new Set())}>{t("showAllDays")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={exporting || !weekly || !allScored}
                title={allScored ? undefined : tw("exportNeedsScores")}
              >
                {exporting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ImageDown className="me-2 h-4 w-4" />}
                {tw("exportImage")}
                <ChevronDown className="ms-1.5 h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void onExport("colorful")}>{t("exportColorful")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void onExport("current")}>{t("exportCurrent")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="icon" onClick={reload} disabled={loading} aria-label={tc("refresh")}>
            <RefreshCw className={cn("h-4 w-4", (loading || countsLoading) && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error && !weekly && <DsErrorState error={error} onRetry={reload} />}
      {loading && !weekly && !error && <Skeleton className="h-96 w-full" />}

      {countsLoading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {tw("loadingCountsFor", { n: countsSummary.total - countsSummary.ready })}
        </p>
      )}
      {countsError && (
        <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {countsError.code === "FORBIDDEN"
              ? tw("countsForbidden")
              : tw("countsUnavailable", { system: systemLabel("inv"), message: countsError.message })}
          </span>
        </div>
      )}

      {weekly &&
        (visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">{results.length === 0 ? tw("empty") : tw("emptyFiltered")}</p>
          </div>
        ) : (
          <Card ref={reportRef} className="gap-0 overflow-hidden p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
              <p className="font-heading text-base font-semibold">
                {tw("reportTitle", {
                  week: weekly.week.label ?? tc("weekLabel", { week: weekly.week.week_no, year: weekly.week.fiscal_year }),
                })}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {day.short(weekly.week.week_start)} → {day.short(weekly.week.week_end)} · {visible.length}
              </p>
            </div>
            <div ref={scrollRef} className="overflow-x-auto">
              <table className="w-full table-fixed text-[11px]" style={{ minWidth: Math.round(tableTotal * SHRINK) }}>
                <colgroup>
                  <col style={{ width: pct(W.store) }} />
                  <col style={{ width: pct(W.plan) }} />
                  {shownDays.flatMap((d) => INGREDIENT_KEYS.map((k) => <col key={`${d}-${k}`} style={{ width: pct(W.cell) }} />))}
                  <col style={{ width: pct(W.stk) }} />
                  <col style={{ width: pct(W.dq) }} />
                  <col style={{ width: pct(W.score) }} />
                  {previous.map((n) => (
                    <col key={n} style={{ width: pct(W.prev) }} />
                  ))}
                  <col style={{ width: pct(W.progress) }} />
                </colgroup>
                <ReportHead
                  days={shownDays}
                  previous={previous}
                  labelOf={labelOf}
                  // The "current" export photographs this card — keep the remove buttons out of the picture.
                  removable={exporting ? NO_DAYS : removable}
                  onRemove={(d) => setRemovedDays((s) => new Set(s).add(d))}
                />
                <tbody>
                  {visible.map((r) => (
                    <Fragment key={r.store}>
                      <ReportRow
                        row={r}
                        days={shownDays}
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
                          <td colSpan={colCount} className="p-3 sm:p-4">
                            <div className="grid gap-x-6 gap-y-5 lg:grid-cols-[1fr_280px]">
                              <div className="min-w-0">
                                {!r.needsCounts || r.countsStatus === "ready" || r.countsStatus === "error" ? (
                                  <WeekCellsGrid cells={r.cells} ingredients={ingredients} />
                                ) : (
                                  <Skeleton className="h-44 w-full" />
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
            <Legend labelOf={labelOf} previous={previous} inProgress={weekly.week.week_end >= todayIso()} />
          </Card>
        ))}

      {sheetOpen && weekly && (
        <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none" }}>
          <ColorfulReportSheet
            ref={sheetRef}
            rows={visible}
            storeNames={storeNames}
            days={shownDays}
            dayCount={days.length}
            previous={previous}
            weekLabel={weekly.week.label ?? tc("weekLabel", { week: weekly.week.week_no, year: weekly.week.fiscal_year })}
            rangeLabel={`${day.short(weekly.week.week_start)} \u2192 ${day.short(weekly.week.week_end)}`}
            inProgress={weekly.week.week_end >= todayIso()}
          />
        </div>
      )}
    </div>
  );
}

const tableWidth = (days: number, prev: number) =>
  W.store + W.plan + days * 3 * W.cell + W.stk + W.dq + W.score + prev * W.prev + W.progress;

const GROUP_TH = "border-s border-border/60 px-0.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wider";
const SUB_TH = "px-0.5 py-1 text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground";

/** Two header rows: the group (day / Quality / Progress), then the abbreviated columns inside it. */
function ReportHead({
  days,
  previous,
  labelOf,
  removable,
  onRemove,
}: {
  days: string[];
  previous: number[];
  labelOf: (k: IngredientKey) => string;
  /** Days with nothing recorded — the only ones that get a remove button. */
  removable: ReadonlySet<string>;
  onRemove: (day: string) => void;
}) {
  const t = useTranslations("doughSauce.report");
  const day = useDayFormatter();
  return (
    <thead className="bg-muted/40">
      <tr>
        <th rowSpan={2} className={cn(SUB_TH, "sticky start-0 z-10 bg-muted px-2 text-start")}>
          {t("colStore")}
        </th>
        <th rowSpan={2} className={SUB_TH} title={t("tipPlan")}>
          {t("colPlan")}
        </th>
        {days.map((d) => (
          <th key={d} colSpan={3} className={cn(GROUP_TH, "relative")}>
            {day.weekday(d)}
            <span className="block text-[9px] font-normal normal-case tracking-normal text-muted-foreground">
              {day.monthDay(d)}
            </span>
            {removable.has(d) && (
              <button
                type="button"
                onClick={() => onRemove(d)}
                title={t("hideDay", { day: `${day.weekday(d)} ${day.monthDay(d)}` })}
                aria-label={t("hideDay", { day: `${day.weekday(d)} ${day.monthDay(d)}` })}
                className="absolute end-0.5 top-0.5 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </th>
        ))}
        <th colSpan={2} className={GROUP_TH}>
          {t("groupQuality")}
        </th>
        <th colSpan={2 + previous.length} className={GROUP_TH}>
          {t("groupProgress")}
        </th>
      </tr>
      <tr className="border-b">
        {days.flatMap((d) =>
          INGREDIENT_KEYS.map((k, i) => (
            <th key={`${d}-${k}`} className={cn(SUB_TH, i === 0 && "border-s border-border/60")} title={labelOf(k)}>
              {t(`abbr.${k}`)}
            </th>
          ))
        )}
        <th className={cn(SUB_TH, "border-s border-border/60")} title={t("tipStk")}>
          {t("colStk")}
        </th>
        <th className={SUB_TH} title={t("tipDq")}>
          {t("colDq")}
        </th>
        <th className={cn(SUB_TH, "border-s border-border/60")} title={t("tipScore")}>
          {t("colScore")}
        </th>
        {previous.map((n) => (
          <th key={n} className={SUB_TH} title={t("tipPrev", { n })}>
            W{n}
          </th>
        ))}
        <th className={SUB_TH} title={t("tipProgress")}>
          {t("colProgress")}
        </th>
      </tr>
    </thead>
  );
}

/** One day × ingredient: the variance (actual − plan). Anything uncountable is N/A, never 0 (rule 2). */
function ReportCell({ cell, first }: { cell?: WeekCell; first?: boolean }) {
  const t = useTranslations("doughSauce.weekly.cells");
  // `first` = first ingredient of a day: a left rule groups the three cells of each day.
  const edge = first && "border-s border-border/60";
  const na = (cls?: string, title?: string) => (
    <td className={cn("px-0.5 py-1 text-center text-xs text-muted-foreground/30", edge, cls)} title={title}>
      {"\u2013"}
    </td>
  );
  if (!cell) return na();
  switch (cell.kind) {
    case "counted":
      return (
        // The report shows whether the day met its plan, not by how much — the number stays out of the cell.
        <td
          className={cn(
            "px-0.5 py-1 text-center",
            edge,
            cell.ok ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/20 text-rose-700 dark:text-rose-400"
          )}
          title={t("countedTitle", { counted: fmtQty(cell.counted), planned: fmtQty(cell.planned) })}
        >
          {cell.ok ? (
            <Check role="img" aria-label={t("legendOk")} className="mx-auto block h-3.5 w-3.5" strokeWidth={3} />
          ) : (
            <X role="img" aria-label={t("legendShort")} className="mx-auto block h-3.5 w-3.5" strokeWidth={3} />
          )}
        </td>
      );
    case "missing":
      return na("bg-amber-500/15 !text-amber-700 !font-bold dark:!text-amber-400", t("neverCounted"));
    case "awaiting":
      return na(undefined, t("awaiting"));
    case "no-plan":
      return na(undefined, t("noPlan"));
    default:
      return na(undefined, t("unavailable"));
  }
}

const COMPACT_TRIGGER = "h-6 w-full justify-center gap-0 px-0 text-[11px] [&>svg]:hidden";

function ReportRow({
  row,
  days,
  storeName,
  weekStart,
  expanded,
  onToggle,
  onSave,
}: {
  row: StoreWeekResult;
  /** The day columns on screen (removed days are left out). The x/7 count below still covers the whole week. */
  days: string[];
  storeName?: string;
  weekStart: string;
  expanded: boolean;
  onToggle: () => void;
  onSave: SaveJudgement;
}) {
  const t = useTranslations("doughSauce.weekly");
  const tr = useTranslations("doughSauce.report");
  const { saving, save, canJudge } = useJudgementSaver(row, weekStart, onSave);
  const pending = !row.judgement?.complete;
  const dayCount = row.cells.days.length;
  const byId = new Map(row.cells.cells.map((c) => [`${c.date}|${c.key}`, c]));

  return (
    <tr className={cn("border-t transition-colors hover:bg-muted/30", expanded && "bg-muted/20")}>
      <td className={cn("sticky start-0 z-10 px-1.5 py-0.5", expanded ? "bg-muted" : "bg-card")}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={t("toggleDetails", { store: row.store })}
          title={storeName ?? row.store}
          className="group flex w-full cursor-pointer items-center gap-1.5 text-start"
        >
          {!row.inactive && row.rank > 0 && (
            <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">{row.rank}</span>
          )}
          <span className="min-w-0">
            <span className={cn("block truncate text-[11px] font-semibold leading-[14px] group-hover:underline", expanded && "underline")}>{storeName ?? row.store}</span>
            {storeName && <span className="block truncate text-[9px] leading-[11px] tabular-nums text-muted-foreground">{row.store}</span>}
          </span>
        </button>
      </td>
      <td className="px-0.5 text-center text-[10px] tabular-nums">
        <span className={cn("inline-flex items-center gap-0.5", row.daysConfirmed === 0 && "text-muted-foreground")}>
          {row.daysConfirmed >= dayCount && dayCount > 0 ? (
            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <X className="h-3 w-3 text-rose-600 dark:text-rose-400" />
          )}
          {row.daysConfirmed}/{dayCount}
        </span>
      </td>

      {days.flatMap((d) =>
        INGREDIENT_KEYS.map((k, i) => <ReportCell key={`${d}-${k}`} cell={byId.get(`${d}|${k}`)} first={i === 0} />)
      )}

      <td className="border-s border-border/60 px-0.5">
        <Select
          value={row.judgement?.stickers_compliance ?? UNSET}
          onValueChange={(v) => save({ stickers_compliance: v === UNSET ? null : (v as StickersVerdict) })}
          disabled={saving || !canJudge}
        >
          <SelectTrigger className={COMPACT_TRIGGER} aria-label={tr("tipStk")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>{t("verdictUnset")}</SelectItem>
            <SelectItem value="yes">{t("stickersYes")}</SelectItem>
            <SelectItem value="no">{t("stickersNo")}</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="px-0.5">
        <Select
          value={row.judgement?.dough_quality ?? UNSET}
          onValueChange={(v) => save({ dough_quality: v === UNSET ? null : (v as QualityVerdict) })}
          disabled={saving || !canJudge}
        >
          <SelectTrigger className={COMPACT_TRIGGER} aria-label={tr("tipDq")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>{t("verdictUnset")}</SelectItem>
            <SelectItem value="pass">{t("qualityPass")}</SelectItem>
            <SelectItem value="fail">{t("qualityFail")}</SelectItem>
          </SelectContent>
        </Select>
      </td>

      <td
        className={cn(
          "relative border-s border-border/60 px-0.5 py-1 text-center tabular-nums",
          row.scored && !row.inactive && toneBg(row.breakdown.score)
        )}
      >
        {row.inactive ? (
          <span className="text-[9px] text-muted-foreground">{t("notStarted")}</span>
        ) : !row.scored ? (
          row.countsStatus === "error" ? (
            <button type="button" onClick={onToggle} className="text-[9px] text-muted-foreground underline-offset-2 hover:underline">
              {t("openToScore")}
            </button>
          ) : (
            <Loader2 className="mx-auto h-3 w-3 animate-spin text-muted-foreground" />
          )
        ) : (
          <>
            <span className="text-sm font-bold leading-4">{fmtPct(row.breakdown.score)}</span>
            {/* A corner dot, not a second line — a pending judgement must not make its row taller. */}
            {pending && (
              <span
                role="img"
                aria-label={t("judgementPending")}
                className="absolute end-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 ring-1 ring-background"
                title={t("judgementPending")}
              />
            )}
          </>
        )}
      </td>
      {row.previousScores.map((s, i) => (
        <td key={i} className={cn("px-0.5 py-1 text-center text-[11px] font-medium tabular-nums", s != null && toneBg(s))}>
          {s == null ? <span className="text-muted-foreground/30">{"\u2013"}</span> : fmtPct(s)}
        </td>
      ))}
      <td className="px-0.5 py-1 text-center tabular-nums">
        {row.inactive || row.progress == null ? (
          <span className="text-muted-foreground">—</span>
        ) : Math.abs(row.progress) < 0.0005 ? (
          <span className="text-[10px] text-muted-foreground">{fmtSignedPct(0)}</span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[10px] font-semibold",
              row.progress > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            )}
          >
            {row.progress > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {fmtSignedPct(row.progress)}
          </span>
        )}
      </td>
    </tr>
  );
}

/** What every abbreviation means — the table itself stays terse. */
function Legend({
  labelOf,
  previous,
  inProgress,
}: {
  labelOf: (k: IngredientKey) => string;
  previous: number[];
  inProgress: boolean;
}) {
  const t = useTranslations("doughSauce.report");
  return (
    <div className="space-y-1.5 border-t bg-muted/20 px-4 py-3 text-[11px] text-muted-foreground">
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        {INGREDIENT_KEYS.map((k) => (
          <span key={k}>
            <b className="text-foreground">{t(`abbr.${k}`)}</b> = {labelOf(k)}
          </span>
        ))}
        <span>
          <b className="text-foreground">{t("colPlan")}</b> = {t("tipPlan")}
        </span>
        <span>
          <b className="text-foreground">{t("colStk")}</b> = {t("tipStk")}
        </span>
        <span>
          <b className="text-foreground">{t("colDq")}</b> = {t("tipDq")}
        </span>
        <span>
          <b className="text-foreground">{t("colScore")}</b> = {t("tipScore")}
        </span>
        {previous.length > 0 && (
          <span>
            <b className="text-foreground">{previous.map((n) => `W${n}`).join(" ")}</b> = {t("tipPrevAll")}
          </span>
        )}
        <span>
          <b className="text-foreground">{t("colProgress")}</b> = {t("tipProgress")}
        </span>
      </p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>{t("legendCell")}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-emerald-500/20" /> {t("legendOk")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-rose-500/25" /> {t("legendShort")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-amber-500/20" /> {t("legendMissing")}
        </span>
        <span>
          <b className="text-foreground/70">{"\u2013"}</b> = {t("legendNa")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {t("legendPending")}
        </span>
        {inProgress && <span>{t("legendInProgress")}</span>}
      </p>
    </div>
  );
}
