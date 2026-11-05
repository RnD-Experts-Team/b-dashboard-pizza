"use client";

import { useMemo, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import { DASH } from "@/components/labor/labor-format";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport, useSection } from "@/components/business-reports/report-context";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { fmtNumD, weekLabel } from "@/components/business-reports/report-format";
import { cn } from "@/lib/utils";
import type { ReportWeek, StoreScoreSection, StoreScoreWeek } from "@/types/business-reports.types";
import { GRID_TD, StoreWeekGrid } from "./br-store-week-grid";

/* ──────────────────────────────────────────────────────────────────────────
 *  Store Score by Week — every loaded store's V1 store score for each week
 *  of the range, coloured like V1's card. Scores arrive in store batches:
 *  the stores already scored show while the rest are still being scored.
 * ────────────────────────────────────────────────────────────────────────── */

const CARD_HEIGHT = 460;
const FULL_SCORE = 100;
const PERCENT = 100;

/** V1 thresholds (% of the max): ≥80 emerald, ≥60 amber, ≥40 orange, else red. */
const GREEN_FROM = 80;
const AMBER_FROM = 60;
const ORANGE_FROM = 40;
const BANDS: Array<{ min: number; tone: Tone }> = [
  { min: GREEN_FROM, tone: "emerald" },
  { min: AMBER_FROM, tone: "amber" },
  { min: ORANGE_FROM, tone: "orange" },
  { min: 0, tone: "red" },
];

type Tone = "emerald" | "amber" | "orange" | "red";

const TONE_TEXT: Record<Tone, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  orange: "text-orange-600 dark:text-orange-400",
  red: "text-red-600 dark:text-red-400",
};
const TONE_BG: Record<Tone, string> = {
  emerald: "bg-emerald-500/10 dark:bg-emerald-500/15",
  amber: "bg-amber-500/10 dark:bg-amber-500/15",
  orange: "bg-orange-500/10 dark:bg-orange-500/15",
  red: "bg-red-500/10 dark:bg-red-500/15",
};
const TONE_BAR: Record<Tone, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
};

function tone(score: number, max = FULL_SCORE): Tone {
  const pct = max > 0 ? (score / max) * PERCENT : 0;
  return BANDS.find((b) => pct >= b.min)?.tone ?? "red";
}

function weekMax(w: StoreScoreWeek): number {
  const total = w.details.reduce((s, d) => s + d.max, 0);
  return total > 0 ? total : FULL_SCORE;
}

interface Selection {
  store: string;
  week: ReportWeek;
  score: StoreScoreWeek;
}

interface WeekRow {
  week: ReportWeek;
  score: StoreScoreWeek;
}

function penaltyText(penalty: number): string {
  return penalty === 0 ? "0" : `-${fmtNumD(Math.abs(penalty))}`;
}

function WeekDetail({
  data,
  weeks,
  selection,
  onSelect,
  onClose,
}: {
  data: StoreScoreSection;
  weeks: ReportWeek[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  onClose: () => void;
}) {
  const { storeName } = useReport();
  const { store, week, score } = selection;
  const max = weekMax(score);
  const t = tone(score.score, max);
  const storeBlock = data.by_store[store];

  const rows = useMemo<WeekRow[]>(
    () => weeks.flatMap((w) => (storeBlock?.weeks[w.week_start] ? [{ week: w, score: storeBlock.weeks[w.week_start] }] : [])),
    [weeks, storeBlock],
  );
  const columns = useMemo<PagedColumn<WeekRow>[]>(
    () => [
      { key: "week", header: "Week", render: (r) => <span className="font-medium">{weekLabel(r.week, true)}</span>, sortValue: (r) => r.week.week_start },
      {
        key: "score",
        header: "Score",
        numeric: true,
        render: (r) => {
          const rt = tone(r.score.score, weekMax(r.score));
          return <span className={cn("font-semibold", TONE_TEXT[rt])}>{fmtNumD(r.score.score)}</span>;
        },
        sortValue: (r) => r.score.score,
      },
      { key: "label", header: "Rating", render: (r) => r.score.label, sortValue: (r) => r.score.label },
      { key: "raw", header: "Before penalty", numeric: true, render: (r) => fmtNumD(r.score.raw_score), sortValue: (r) => r.score.raw_score },
      {
        key: "penalty",
        header: "Penalty",
        numeric: true,
        render: (r) => (
          <span className={r.score.non_negotiable.penalty === 0 ? undefined : TONE_TEXT.red}>{penaltyText(r.score.non_negotiable.penalty)}</span>
        ),
        sortValue: (r) => r.score.non_negotiable.penalty,
      },
    ],
    [],
  );

  const stats: ReportStat[] = [
    { label: "Score", value: `${fmtNumD(score.score)} / ${fmtNumD(max)}`, tone: TONE_TEXT[t] },
    { label: "Rating", value: score.label, tone: TONE_TEXT[t] },
    { label: "Before penalty", value: fmtNumD(score.raw_score) },
    {
      label: "Non-negotiable penalty",
      value: penaltyText(score.non_negotiable.penalty),
      sub: `${score.non_negotiable.entries} entries · ${score.non_negotiable.downtime} downtime · ${score.non_negotiable.other} other`,
      tone: score.non_negotiable.penalty === 0 ? undefined : TONE_TEXT.red,
    },
    {
      label: "Store average",
      value: storeBlock ? fmtNumD(storeBlock.average_score) : DASH,
      sub: storeBlock?.average_label,
    },
    { label: "Week", value: weekLabel(week), sub: `${week.start} → ${week.end}` },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={`${storeName(store)} — Store Score`}
      category="sales"
      subtitle={`${weekLabel(week, true)} · scored as of ${score.as_of}`}
      stats={stats}
      tabs={[
        {
          key: "categories",
          label: "Categories",
          content: (
            <ReportBlock title={`Categories · ${weekLabel(week)}`}>
              <div className="space-y-2">
                {score.details.map((d) => {
                  const dt = d.score >= d.max ? "emerald" : tone(d.score, d.max);
                  const width = d.max > 0 ? Math.min(PERCENT, (d.score / d.max) * PERCENT) : 0;
                  return (
                    <div key={d.key} className="flex items-center gap-3">
                      <span className="w-60 shrink-0 truncate text-[13px] text-muted-foreground">
                        {d.label}
                        {d.actual_percent !== null && d.actual_percent !== undefined && (
                          <span className="ms-1 text-xs text-muted-foreground/70">({fmtNumD(d.actual_percent)}%)</span>
                        )}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", TONE_BAR[dt])} style={{ width: `${width}%` }} />
                      </div>
                      <span className={cn("w-20 shrink-0 text-end text-[13px] font-semibold tabular-nums", TONE_TEXT[dt])}>
                        {fmtNumD(d.score)}/{fmtNumD(d.max)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ReportBlock>
          ),
        },
        {
          key: "weeks",
          label: `Every week (${rows.length})`,
          content: (
            <PagedTable
              size="lg"
              rows={rows}
              columns={columns}
              rowKey={(r) => r.week.week_start}
              initialSort="week"
              initialDir="asc"
              onRowClick={(r) => onSelect({ store, week: r.week, score: r.score })}
              rowClassName={(r) => (r.week.week_start === week.week_start ? "bg-primary/10" : undefined)}
              footerNote="click a week to open its breakdown"
            />
          ),
        },
      ]}
    />
  );
}

export function BrStoreScoreWeeks({ data }: { data: StoreScoreSection }) {
  const { params, storeName } = useReport();
  const { loading } = useSection("storeScore");
  const [selected, setSelected] = useState<Selection | null>(null);
  const weeks = data.meta.weeks;

  const stores = useMemo(
    () =>
      params.stores
        .filter((s) => data.by_store[s])
        .sort((a, b) => data.by_store[b].average_score - data.by_store[a].average_score),
    [params.stores, data.by_store],
  );
  const pending = loading ? Math.max(0, params.stores.length - stores.length) : 0;

  const renderRowHead = (store: string) => {
    const s = data.by_store[store];
    const t = tone(s.average_score);
    return (
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{storeName(store)}</span>
        <span className={cn("shrink-0 rounded px-1 text-[10px] font-bold tabular-nums", TONE_BG[t], TONE_TEXT[t])} title={s.average_label}>
          {fmtNumD(s.average_score)} · {s.average_label}
        </span>
      </span>
    );
  };

  const renderCell = (store: string, week: ReportWeek) => {
    const score = data.by_store[store].weeks[week.week_start];
    if (!score) {
      return (
        <td key={week.week_start} className={cn(GRID_TD, "text-muted-foreground/60")}>
          {DASH}
        </td>
      );
    }
    const t = tone(score.score, weekMax(score));
    return (
      <td key={week.week_start} className={cn(GRID_TD, "p-0.5")}>
        <button
          type="button"
          onClick={() => setSelected({ store, week, score })}
          title={`${weekLabel(week)} · ${score.label} — click for the breakdown`}
          className={cn("h-6 w-full rounded font-bold transition-opacity hover:opacity-80", TONE_BG[t], TONE_TEXT[t])}
        >
          {fmtNumD(score.score)}
        </button>
      </td>
    );
  };

  return (
    <V1Card
      reportId="br-store-score-weeks"
      title="Store Score by Week"
      category="sales"
      period="R"
      span={4}
      height={CARD_HEIGHT}
      headerNote={
        pending > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            scoring {pending} more store{pending === 1 ? "" : "s"}…
          </span>
        ) : undefined
      }
    >
      {stores.length === 0 ? (
        <V1Empty icon={Star}>{loading ? "Scoring stores…" : "No store scores for this range"}</V1Empty>
      ) : (
        <StoreWeekGrid
          stores={stores}
          weeks={weeks}
          firstColLabel="Store · average"
          renderRowHead={renderRowHead}
          renderCell={renderCell}
          note="click a score for its breakdown"
        />
      )}

      {selected && (
        <WeekDetail data={data} weeks={weeks} selection={selected} onSelect={setSelected} onClose={() => setSelected(null)} />
      )}
    </V1Card>
  );
}
