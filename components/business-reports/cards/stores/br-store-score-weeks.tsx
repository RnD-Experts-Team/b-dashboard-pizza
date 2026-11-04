"use client";

import { useMemo, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1MetricGrid, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { DASH } from "@/components/labor/labor-format";
import { useReport, useSection } from "@/components/business-reports/report-context";
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

function WeekDetail({ score }: { score: StoreScoreWeek }) {
  const max = weekMax(score);
  const t = tone(score.score, max);
  return (
    <div className="space-y-4">
      <V1MetricGrid cols={4}>
        <V1Metric label="Score" value={`${fmtNumD(score.score)} / ${fmtNumD(max)}`} accent={TONE_TEXT[t]} />
        <V1Metric label="Rating" value={score.label} accent={TONE_TEXT[t]} size="sm" />
        <V1Metric label="Before Penalty" value={fmtNumD(score.raw_score)} />
        <V1Metric
          label="Non-Negotiable Penalty"
          value={score.non_negotiable.penalty === 0 ? "0" : `-${fmtNumD(Math.abs(score.non_negotiable.penalty))}`}
          sub={`${score.non_negotiable.entries} entries · ${score.non_negotiable.downtime} downtime · ${score.non_negotiable.other} other`}
          accent={score.non_negotiable.penalty === 0 ? undefined : TONE_TEXT.red}
        />
      </V1MetricGrid>
      <div>
        <V1SubLabel className="mb-1">Categories</V1SubLabel>
        <div className="space-y-1">
          {score.details.map((d) => {
            const dt = d.score >= d.max ? "emerald" : tone(d.score, d.max);
            const width = d.max > 0 ? Math.min(PERCENT, (d.score / d.max) * PERCENT) : 0;
            return (
              <div key={d.key} className="flex items-center gap-2">
                <span className="w-44 shrink-0 truncate text-[12px] text-muted-foreground">
                  {d.label}
                  {d.actual_percent !== null && d.actual_percent !== undefined && (
                    <span className="ms-1 text-[10px] text-muted-foreground/70">({fmtNumD(d.actual_percent)}%)</span>
                  )}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", TONE_BAR[dt])} style={{ width: `${width}%` }} />
                </div>
                <span className={cn("w-16 shrink-0 text-end text-[12px] font-semibold tabular-nums", TONE_TEXT[dt])}>
                  {fmtNumD(d.score)}/{fmtNumD(d.max)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Scored as of {score.as_of}.</p>
    </div>
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
          title={`${score.label} — click for the breakdown`}
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
        <WbrDetailDialog
          open={selected !== null}
          onOpenChange={(o) => {
            if (!o) setSelected(null);
          }}
          title={`${storeName(selected.store)} — Store Score`}
          badgeText={weekLabel(selected.week)}
          className="sm:max-w-2xl"
        >
          <WeekDetail score={selected.score} />
        </WbrDetailDialog>
      )}
    </V1Card>
  );
}
