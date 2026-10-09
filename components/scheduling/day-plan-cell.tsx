"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanRowStore } from "@/lib/scheduling/plan-row.store";
import { Collapse } from "./collapse";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./delayed-tooltip";
import {
  compactMoney,
  gapText,
  hourRange,
  isoDateLabel,
  shortHour,
  type DayPlan,
  type HourStatus,
  type PlanHour,
  type WeekPlan,
} from "@/lib/scheduling/day-plan";
import type { WeekInfo } from "@/types/scheduling.types";

/**
 * The plan row under the day headers of the scheduling grid.
 *
 * Read first, operate second. Every cell says, without touching anything:
 *   how big the day is        expected sales, hours planned of usual
 *   when it is busy           one bar per hour: grey is what usually works,
 *                             colour is your plan against it
 *   what is still wrong       "Short 2 · 5–7p", in words
 *
 * And when a number has to be exact:
 *   the table                 the hour-by-hour numbers for EVERY hour of the
 *                             day, in every day, so a column can be read
 *                             straight down. There is no choosing hours: it is
 *                             always all of them
 *   hover a bar or a row      that hour's exact figures, and the same hour lit
 *                             up in every day so days compare at a glance
 *
 * The row is pinned with the day headers, so all of it stays in view however
 * far down the roster you are. That makes it tall, so it folds three ways: the
 * whole row down to its title bar (the arrow beside the title), or just the
 * bar chart, or just the table, each from its own switch in the left cell and
 * each leaving the day's totals and status words. The choices are remembered in
 * `usePlanRowStore`.
 */

const FILL: Record<HourStatus, string> = {
  short: "bg-amber-500 dark:bg-amber-400",
  ok: "bg-emerald-500 dark:bg-emerald-400",
  extra: "bg-sky-500 dark:bg-sky-400",
  closed: "bg-muted-foreground/40",
};

const TEXT: Record<HourStatus, string> = {
  short: "text-amber-700 dark:text-amber-400",
  ok: "text-emerald-700 dark:text-emerald-400",
  extra: "text-sky-700 dark:text-sky-400",
  closed: "text-muted-foreground",
};

const people = (n: number) => (Math.round(n * 10) / 10).toString();
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/* ── One hour, in full ──────────────────────────────────────────────────── */

function HourDetail({ day, h }: { day: DayPlan; h: PlanHour }) {
  const diff = h.usual !== null ? h.planned - h.usual : null;
  const rows: [string, React.ReactNode][] = [];

  if (h.usual !== null) {
    rows.push([
      "On the clock",
      <>
        <b>{people(h.usual)}</b> usually
        {h.usualRange && h.usualRange[0] !== h.usualRange[1] && (
          <span className="opacity-70"> ({people(h.usualRange[0])}–{people(h.usualRange[1])})</span>
        )}
      </>,
    ]);
  }
  if (h.usualScheduled !== null) {
    rows.push(["Scheduled", <><b>{people(h.usualScheduled)}</b> usually</>]);
  }
  rows.push([
    "Your plan",
    <>
      <b>{people(h.planned)}</b>
      {diff !== null && Math.abs(diff) >= 0.25 && (
        <span className="opacity-70"> ({diff > 0 ? "+" : ""}{people(diff)})</span>
      )}
    </>,
  ]);
  if (h.sales !== null) {
    rows.push([
      "Sales",
      <>
        <b>{money(h.sales)}</b>
        {h.salesRange && Math.round(h.salesRange[0]) !== Math.round(h.salesRange[1]) && (
          <span className="opacity-70"> ({money(h.salesRange[0])}–{money(h.salesRange[1])})</span>
        )}
      </>,
    ]);
  }
  if (h.orders !== null) rows.push(["Orders", <b key="orders">{Math.round(h.orders)}</b>]);
  if (h.sales !== null && h.usual && h.usual >= 0.5) {
    rows.push(["Sales / person", <b key="per-person">{money(h.sales / h.usual)}</b>]);
  }

  return (
    <div className="min-w-44 space-y-1 py-0.5 text-left">
      <p className="font-semibold">
        {day.name} · {hourRange(h.hour, (h.hour + 1) % 24)}
      </p>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <span className="opacity-70">{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
      {h.odd.length > 0 && (
        <div className="border-t border-background/20 pt-1">
          {h.odd.map((a, i) => (
            <p key={i} className="opacity-80">
              {isoDateLabel(a.date)} was odd:{" "}
              {a.metric === "headcount" ? `${people(a.value)} people` : `${money(a.value)} sales`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── The strip ──────────────────────────────────────────────────────────── */

interface StripProps {
  day: DayPlan;
  plan: WeekPlan;
  hoverIdx: number | null;
  onHover: (idx: number | null) => void;
}

function HourStrip({ day, plan, hoverIdx, onHover }: StripProps) {
  return (
    <div className="flex h-20 items-end" onMouseLeave={() => onHover(null)}>
      {day.hours.map((h, idx) => {
        const usualPct = h.usual === null ? 0 : Math.min(100, (h.usual / plan.scale) * 100);
        const plannedPct = Math.min(100, (h.planned / plan.scale) * 100);
        return (
          <Tooltip key={h.hour}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "relative h-full min-w-0 flex-1 cursor-default px-px",
                  hoverIdx === idx && "bg-foreground/10",
                )}
                onMouseEnter={() => onHover(idx)}
              >
                <div className="relative h-full">
                  {/* What usually works this hour */}
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-[2px] bg-muted-foreground/20"
                    style={{ height: `${usualPct}%` }}
                  />
                  {/* What is planned */}
                  {h.planned > 0 && (
                    <div
                      className={cn("absolute inset-x-0 bottom-0 rounded-t-[2px]", FILL[h.status])}
                      style={{ height: `${Math.max(plannedPct, 4)}%` }}
                    />
                  )}
                  {/* The usual level, visible where the plan covers it */}
                  {h.usual !== null && h.usual >= 0.25 && (
                    <div
                      className="absolute inset-x-0 h-px bg-foreground/50"
                      style={{ bottom: `${usualPct}%` }}
                    />
                  )}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <HourDetail day={day} h={h} />
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/* ── Every hour, as exact numbers ───────────────────────────────────────── */

/** Hour rows visible before the list scrolls. The summary never scrolls away. */
const VISIBLE_ROWS = 6;

/**
 * One grid for header, hours and summary, so every number sits under its label.
 *
 * Columns size to their content (`auto` / `minmax(0,1fr)`), never to fixed
 * widths: a fixed width is what made "4.2" and "usual" collide in a narrow day.
 * The block is its own container, and below ~7rem the text steps down a size
 * rather than letting anything overlap or wrap.
 */
const ROW =
  "grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-1 px-1 whitespace-nowrap";

const sumOf = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
};

/** People summed over hours are person-hours: "20h". */
const hoursOf = (n: number) => `${n >= 10 ? Math.round(n) : people(n)}h`;

interface HourTableProps {
  day: DayPlan;
  hoverIdx: number | null;
  onHover: (idx: number | null) => void;
  /** The hour list, registered so every day's list scrolls together. */
  listRef: (el: HTMLDivElement | null) => void;
  onListScroll: (el: HTMLDivElement) => void;
}

function HourTable({ day, hoverIdx, onHover, listRef, onListScroll }: HourTableProps) {
  const hours = day.hours;
  if (hours.length === 0) return null;

  const n = hours.length;
  const usualSum = sumOf(hours.map((h) => h.usual));
  const plannedSum = hours.reduce((a, h) => a + h.planned, 0);
  const salesSum = sumOf(hours.map((h) => h.sales));

  return (
    <div className="@container overflow-hidden rounded-md border border-primary/15 bg-primary/5 text-[10px] leading-4 tabular-nums @max-[6.75rem]:text-[9px]">
      {/* Labels */}
      <div className={cn(ROW, "border-b border-primary/10 text-[9px] text-muted-foreground")}>
        <span>{n} hrs</span>
        <span className="text-right">usual</span>
        <span className="text-right">plan</span>
        <span className="text-right">sales</span>
      </div>

      {/* Every hour, on its own. Scrolls past six, in step with the other days. */}
      <div
        ref={listRef}
        onScroll={(e) => onListScroll(e.currentTarget)}
        onMouseLeave={() => onHover(null)}
        className="overflow-y-auto"
        style={{ maxHeight: `${VISIBLE_ROWS}rem` }}
      >
        {hours.map((h, idx) => {
          return (
            <div
              key={h.hour}
              onMouseEnter={() => onHover(idx)}
              className={cn(ROW, "h-4", hoverIdx === idx && "bg-foreground/10")}
            >
              <span className="text-muted-foreground">{shortHour(h.hour)}</span>
              <span className="text-right">{h.usual !== null ? people(h.usual) : "–"}</span>
              <span className={cn("text-right font-semibold", TEXT[h.status])}>{people(h.planned)}</span>
              <span className="text-right">{h.sales !== null ? compactMoney(h.sales) : "–"}</span>
            </div>
          );
        })}
      </div>

      {/* The day as a whole: per hour on average, and in total */}
      {n > 1 && (
        <div className="border-t border-primary/15 bg-primary/5 font-medium">
          <div className={cn(ROW, "h-4")}>
            <span className="text-[9px] text-muted-foreground">avg</span>
            <span className="text-right">{usualSum !== null ? people(usualSum / n) : "–"}</span>
            <span className="text-right">{people(plannedSum / n)}</span>
            <span className="text-right">{salesSum !== null ? compactMoney(salesSum / n) : "–"}</span>
          </div>
          <div className={cn(ROW, "h-4")}>
            <span className="text-[9px] text-muted-foreground">total</span>
            <span className="text-right">{usualSum !== null ? hoursOf(usualSum) : "–"}</span>
            <span className="text-right">{hoursOf(plannedSum)}</span>
            <span className="text-right">{salesSum !== null ? compactMoney(salesSum) : "–"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Status in words ────────────────────────────────────────────────────── */

function StatusLines({ day }: { day: DayPlan }) {
  if (day.state === "no-history") {
    return <p className="text-[10px] text-muted-foreground">No history for this day</p>;
  }

  if (day.state === "not-started") {
    const peak = day.hours.reduce<PlanHour | null>(
      (best, h) => (h.usual !== null && (!best || h.usual > (best.usual ?? 0)) ? h : best),
      null,
    );
    return (
      <p className="text-[10px] text-muted-foreground">
        Not started
        {peak?.usual && peak.usual >= 0.5 ? ` · peak ${Math.round(peak.usual)} at ${shortHour(peak.hour)}` : ""}
      </p>
    );
  }

  if (day.state === "matches") {
    return (
      <p className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="h-3 w-3" /> Matches usual
      </p>
    );
  }

  const shown = day.gaps.slice(0, 3);
  const more = day.gaps.length - shown.length;
  return (
    <div className="space-y-px">
      {shown.map((g) => (
        <p
          key={`${g.kind}${g.from}`}
          className={cn(
            "truncate text-[10px] font-medium tabular-nums",
            g.kind === "short" ? TEXT.short : TEXT.extra,
          )}
        >
          {gapText(g)}
        </p>
      ))}
      {more > 0 && <p className="text-[10px] text-muted-foreground">+{more} more</p>}
    </div>
  );
}

/* ── One day ────────────────────────────────────────────────────────────── */

interface DayPlanCellProps extends StripProps {
  listRef: (el: HTMLDivElement | null) => void;
  onListScroll: (el: HTMLDivElement) => void;
  /** Put away on their own, leaving the day's totals and status words. */
  chartHidden: boolean;
  tableHidden: boolean;
}

function DayPlanCell({ listRef, onListScroll, chartHidden, tableHidden, ...props }: DayPlanCellProps) {
  const { day, plan, hoverIdx, onHover } = props;
  const hasHistory = day.state !== "no-history";
  const usual = day.usualHours;

  return (
    // `w-0 min-w-full`: fill the column, never widen it. Otherwise a long gap
    // line would stretch its day and push the week off the screen.
    // The 4px between blocks is `pt-1` on each block rather than a gap on the
    // column, so a block that slides away takes its gap with it.
    <div className="w-0 min-w-full text-left">
      {/* How big the day is */}
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-xs font-semibold tabular-nums">
          {day.expectedSales !== null ? compactMoney(day.expectedSales) : "—"}
          <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">sales</span>
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{Math.round(day.plannedHours)}</span>
          {usual !== null ? `/${Math.round(usual)}h` : "h"}
        </span>
      </div>

      {/* Between the day's totals and what follows. Always drawn, so the lines
          and the blocks under them stay level across all seven days. */}
      <div className="pt-1">
        <div className="h-px bg-border" aria-hidden />
      </div>

      {/* When it is busy, and how the plan meets it */}
      {hasHistory && plan.hours.length > 0 && (
        <Collapse open={!chartHidden}>
          <div className="pt-1">
            <HourStrip {...props} />
            <div className="mt-px flex justify-between text-[8px] leading-none text-muted-foreground">
              <span>{shortHour(plan.hours[0])}</span>
              {hoverIdx !== null && (
                <span className="font-semibold text-foreground">{shortHour(plan.hours[hoverIdx])}</span>
              )}
              <span>{shortHour((plan.hours[plan.hours.length - 1] + 1) % 24)}</span>
            </div>
          </div>
        </Collapse>
      )}

      {/* Every hour, exact */}
      {hasHistory && (
        <Collapse open={!tableHidden}>
          <div className="pt-1">
            <HourTable
              day={day}
              hoverIdx={hoverIdx}
              onHover={onHover}
              listRef={listRef}
              onListScroll={onListScroll}
            />
          </div>
        </Collapse>
      )}

      {/* What is left to fix */}
      <div className="pt-1">
        <StatusLines day={day} />
      </div>

      {/* How much history stands behind these numbers */}
      {hasHistory && day.sampled < day.weeksInWindow && (
        <p className="pt-1 text-[9px] text-muted-foreground">
          From {day.sampled} of {day.weeksInWindow} weeks
        </p>
      )}
    </div>
  );
}

function DayPlanCellSkeleton() {
  return (
    <div className="space-y-1">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-2.5 w-3/4" />
    </div>
  );
}

/* ── The pinned left cell: what the row is, and what to show of it ──────── */

/** The row's title, which is also the button that folds it away and back. */
function PlanRowToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="-ms-1 flex items-center gap-1 rounded px-1 py-0.5 text-start text-[9px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-xs"
    >
      {/* Turns with the slide, rather than swapping to a different icon. */}
      <ChevronDown
        className={cn(
          "h-3 w-3 shrink-0 transition-transform duration-300 motion-reduce:transition-none",
          collapsed && "-rotate-90 rtl:rotate-90",
        )}
        aria-hidden
      />
      Plan vs usual
    </button>
  );
}

/**
 * A small switch that puts one body of the row away or brings it back, without
 * touching the rest of the row. Open shows a down chevron, put away a right one.
 * The focus ring is drawn inset because it sits inside a `Collapse`, which clips.
 */
function SectionToggle({
  label,
  hint,
  hidden,
  onToggle,
}: {
  label: string;
  /** What it holds, for the tooltip and screen readers. */
  hint: string;
  hidden: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!hidden}
      aria-label={`${hidden ? "Show" : "Hide"} the ${label.toLowerCase()}: ${hint}`}
      title={`${hidden ? "Show" : "Hide"}: ${hint}`}
      className={cn(
        "flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
        hidden ? "border-dashed text-muted-foreground" : "text-foreground",
      )}
    >
      <ChevronDown
        className={cn(
          "h-3 w-3 shrink-0 transition-transform duration-300 motion-reduce:transition-none",
          hidden && "-rotate-90 rtl:rotate-90",
        )}
        aria-hidden
      />
      {label}
    </button>
  );
}

function PlanLegendCell({
  plan,
  collapsed,
  onToggle,
  chartHidden,
  tableHidden,
  onToggleChart,
  onToggleTable,
}: {
  plan: WeekPlan | null;
  /** The whole row is folded: only the title stays. */
  collapsed: boolean;
  onToggle: () => void;
  chartHidden: boolean;
  tableHidden: boolean;
  onToggleChart: () => void;
  onToggleTable: () => void;
}) {
  const hasHours = (plan?.hours.length ?? 0) > 0;

  return (
    <div className="text-left">
      <PlanRowToggle collapsed={collapsed} onToggle={onToggle} />
      <Collapse open={!collapsed}>
        <div className="space-y-1.5 pt-1.5">
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-medium sm:text-[10px]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-[2px] bg-amber-500" />
          Short
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-[2px] bg-emerald-500" />
          OK
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-[2px] bg-sky-500" />
          Extra
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <span className="h-2 w-2 rounded-[2px] bg-muted-foreground/30" />
          Usual
        </span>
      </div>

      {hasHours && (
        <div className="space-y-1">
          {/* Only worth saying while there are bars to hover. */}
          {!chartHidden && (
            <p className="hidden text-[10px] leading-tight text-muted-foreground sm:block">
              Hover a bar for that hour in full, in every day.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1">
            <SectionToggle
              label="Chart"
              hint="the hour-by-hour bars"
              hidden={chartHidden}
              onToggle={onToggleChart}
            />
            <SectionToggle
              label="Table"
              hint="the numbers for every hour"
              hidden={tableHidden}
              onToggle={onToggleTable}
            />
          </div>
        </div>
      )}

      {plan?.missing.staffing && (
        <p className="text-[9px] leading-tight text-amber-700 dark:text-amber-400">
          Staffing history unavailable
        </p>
      )}
      {plan?.missing.sales && (
        <p className="text-[9px] leading-tight text-amber-700 dark:text-amber-400">
          Sales history unavailable
        </p>
      )}
        </div>
      </Collapse>
    </div>
  );
}

/* ── The whole row ──────────────────────────────────────────────────────── */

export function PlanRow({
  plan,
  week,
  todayIndex,
}: {
  plan: WeekPlan | null;
  week: WeekInfo;
  todayIndex: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const collapsed = usePlanRowStore((s) => s.collapsed);
  const setCollapsed = usePlanRowStore((s) => s.setCollapsed);
  const chartHidden = usePlanRowStore((s) => s.chartHidden);
  const setChartHidden = usePlanRowStore((s) => s.setChartHidden);
  const tableHidden = usePlanRowStore((s) => s.tableHidden);
  const setTableHidden = usePlanRowStore((s) => s.setTableHidden);

  /**
   * The hour lists of all seven days scroll as one, so a given row is the same
   * hour in every column. Setting the others fires their own scroll events,
   * which find nothing left to change and stop there.
   */
  const lists = useRef<(HTMLDivElement | null)[]>([]);
  const syncScroll = (source: HTMLDivElement) => {
    for (const el of lists.current) {
      if (el && el !== source && Math.abs(el.scrollTop - source.scrollTop) > 0.5) {
        el.scrollTop = source.scrollTop;
      }
    }
  };

  const toggle = () => setCollapsed(!collapsed);

  // One row, folded or not: folding slides every cell's contents shut and eases
  // the title cell's padding in, until only the title bar is left. Today's tint
  // stays throughout, so the column still reads straight through from the day
  // header below to the top of the pinned header.
  return (
    <tr className="border-b">
      <th
        className={cn(
          "relative md:sticky left-0 z-20 bg-card border-r px-2 sm:px-3 align-top font-normal transition-[padding] duration-300 motion-reduce:transition-none",
          collapsed ? "py-1" : "py-2",
        )}
      >
        <PlanLegendCell
          plan={plan}
          collapsed={collapsed}
          onToggle={toggle}
          chartHidden={chartHidden}
          tableHidden={tableHidden}
          onToggleChart={() => setChartHidden(!chartHidden)}
          onToggleTable={() => setTableHidden(!tableHidden)}
        />
      </th>
      {week.dayNamesShort.map((name, i) => {
        const day = plan?.days[i];
        return (
          <th
            key={name}
            className={cn(
              "border-r last:border-r-0 px-1.5 sm:px-2 py-2 align-top font-normal",
              todayIndex === i && "bg-primary/5",
            )}
          >
            <Collapse open={!collapsed}>
              {plan && day ? (
                <DayPlanCell
                  day={day}
                  plan={plan}
                  hoverIdx={hoverIdx}
                  onHover={setHoverIdx}
                  chartHidden={chartHidden}
                  tableHidden={tableHidden}
                  listRef={(el) => {
                    lists.current[i] = el;
                  }}
                  onListScroll={syncScroll}
                />
              ) : (
                <DayPlanCellSkeleton />
              )}
            </Collapse>
          </th>
        );
      })}
      <th className="px-1 sm:px-2 py-2 align-top font-normal text-center">
        <Collapse open={!collapsed}>
          {plan?.usualHours != null && (
            <p className="text-[10px] leading-tight text-muted-foreground tabular-nums">
              usual
              <br />
              <span className="font-semibold text-foreground">{Math.round(plan.usualHours)}h</span>
            </p>
          )}
        </Collapse>
      </th>
    </tr>
  );
}
