"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./delayed-tooltip";
import { KINDS, LensLegend, type LegendItem } from "./odd-days-kinds";
import { clockHour, isoDateLabel, type OddDay, type WeekPlan } from "@/lib/scheduling/day-plan";
import { buildDayChart, type DayBar, type DayMeasure } from "@/lib/scheduling/odd-days";

/**
 * One odd date, hour by hour. Grey is what that hour usually looks like and
 * colour is that date, only at the hours that were odd, the same grey-and-colour
 * reading as the Plan vs usual row. The legend is a lens: hover or focus an entry
 * and the matching bars stay bright while the rest fade.
 *
 * The bars grow up from the baseline each time the pane opens, which is also why
 * they are drawn from divs and not a chart library.
 */

type DayLens = "usual" | "spike" | "dip";

const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const people = (n: number) => `${Math.round(n * 10) / 10}`;
const laborHours = (n: number) => `${Math.round(n)}h`;

function HourBars({
  title,
  bars,
  max,
  format,
  active,
  lens,
}: {
  title: string;
  bars: DayBar[];
  max: number;
  format: (n: number) => string;
  /** Whether the pane is showing, so the bars grow up each time it opens. */
  active: boolean;
  lens: DayLens | null;
}) {
  const pct = (n: number | null) => (n === null ? 0 : Math.min(100, (n / max) * 100));
  const flagged = bars.some((b) => b.actual !== null);

  // They always start flat and are let go a frame later: on the very first open
  // the pane mounts already "active", and with no earlier state there would be
  // nothing to animate from.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => {
      cancelAnimationFrame(frame);
      setGrown(false);
    };
  }, [active]);

  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-medium text-foreground">{title}</span>
        {!flagged && <span className="text-muted-foreground">nothing odd here</span>}
      </div>

      <div className="flex h-6 items-end gap-px @[32.5rem]:h-8">
        {bars.map((b, i) => (
          <Tooltip key={b.hour}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "relative h-full min-w-0 flex-1 transition-opacity duration-200 motion-reduce:transition-none",
                  lens !== null && lens !== "usual" && b.kind !== lens && "opacity-30",
                )}
              >
                <div
                  className={cn(
                    "absolute inset-0 origin-bottom transition-transform duration-500 ease-out motion-reduce:transition-none",
                    grown ? "scale-y-100" : "scale-y-0",
                  )}
                  style={{ transitionDelay: grown ? `${i * 14}ms` : "0ms" }}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-[2px] bg-muted-foreground/25"
                    style={{ height: `${pct(b.usual)}%` }}
                  />
                  {b.actual !== null && b.kind && (
                    <div
                      className={cn(
                        "absolute inset-x-0 bottom-0 rounded-t-[2px] transition-opacity duration-200",
                        KINDS[b.kind].bar,
                        lens === "usual" && "opacity-25",
                      )}
                      style={{ height: `${Math.max(pct(b.actual), 4)}%` }}
                    />
                  )}
                  {b.actual !== null && b.usual !== null && (
                    <div
                      className="absolute inset-x-0 h-px bg-foreground/60"
                      style={{ bottom: `${pct(b.usual)}%` }}
                    />
                  )}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="font-semibold">{clockHour(b.hour)}</p>
              {b.actual !== null ? (
                <p>
                  <b>{format(b.actual)}</b>
                  {b.usual !== null && <> vs usually {format(b.usual)}</>}
                </p>
              ) : b.usual !== null ? (
                <p>usually {format(b.usual)}</p>
              ) : (
                <p>no history</p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="mt-px flex justify-between text-[9px] leading-none text-muted-foreground">
        <span>{clockHour(bars[0].hour)}</span>
        <span>{clockHour(bars[bars.length - 1].hour + 1)}</span>
      </div>
    </div>
  );
}

/** A whole-day figure: the day against its usual, as two bars and the numbers. */
function Measure({ label, m, format }: { label: string; m: DayMeasure; format: (n: number) => string }) {
  const top = Math.max(m.value, m.usual, 1);
  const change = m.usual > 0 ? Math.round((m.value / m.usual - 1) * 100) : null;
  const style = KINDS[m.kind];
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-20 shrink-0 font-medium text-foreground">{label}</span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="h-1.5 rounded-full bg-muted">
          <div className={cn("h-full rounded-full", style.bar)} style={{ width: `${(m.value / top) * 100}%` }} />
        </div>
        <div className="h-1.5 rounded-full bg-muted">
          <div className="h-full rounded-full bg-muted-foreground/30" style={{ width: `${(m.usual / top) * 100}%` }} />
        </div>
      </div>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        <b className="text-foreground">{format(m.value)}</b> vs {format(m.usual)}
        {change !== null && (
          <span className={cn("ms-1 font-semibold", style.text)}>
            {change > 0 ? "+" : ""}
            {change}%
          </span>
        )}
      </span>
    </div>
  );
}

export function OddDayChart({
  plan,
  odd,
  active,
  onBack,
  backRef,
}: {
  plan: WeekPlan;
  odd: OddDay;
  active: boolean;
  onBack: () => void;
  backRef: React.Ref<HTMLButtonElement>;
}) {
  const chart = useMemo(() => buildDayChart(plan, odd), [plan, odd]);

  const [hovered, setHovered] = useState<DayLens | null>(null);
  const [pinned, setPinned] = useState<DayLens | null>(null);
  const lens = hovered ?? pinned;

  const all = [...(chart.sales ?? []), ...(chart.people ?? [])];
  const hasKind = (k: "spike" | "dip") => all.some((b) => b.kind === k);
  const hourFindings = all.some((b) => b.actual !== null);
  const nothing = !chart.sales && !chart.people && !chart.daily && !chart.labor;

  const items: LegendItem<DayLens>[] = [
    { key: "usual", label: "Usual", mark: <span className="h-2 w-2 rounded-[2px] bg-muted-foreground/30" /> },
    ...(["spike", "dip"] as const)
      .filter(hasKind)
      .map((k) => ({
        key: k,
        label: KINDS[k].label,
        mark: <span className={cn("h-2 w-2 rounded-[2px]", KINDS[k].bar)} />,
      })),
  ];

  const columns = [
    {
      key: "sales",
      chart: chart.sales && (
        <HourBars title="Sales per hour" bars={chart.sales} max={chart.salesMax} format={dollars} active={active} lens={lens} />
      ),
      measure: chart.daily && <Measure label="Day sales" m={chart.daily} format={dollars} />,
    },
    {
      key: "people",
      chart: chart.people && (
        <HourBars
          title="People on the clock"
          bars={chart.people}
          max={chart.peopleMax}
          format={people}
          active={active}
          lens={lens}
        />
      ),
      measure: chart.labor && <Measure label="Labor hours" m={chart.labor} format={laborHours} />,
    },
  ].filter((col) => col.chart || col.measure);
  const style = KINDS[odd.kind];
  const KindIcon = style.icon;

  return (
    // Its own container, so the bars can be taller, and the two hour charts can sit side by side, when the pane is wide.
    <div className="@container flex h-full flex-col gap-1.5">
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          ref={backRef}
          onClick={onBack}
          aria-label="Back to the calendar"
          className="rounded p-0.5 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:-scale-x-100" />
        </button>
        <span className="text-xs font-semibold text-foreground">{isoDateLabel(odd.date)}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
            style.soft,
            style.text,
          )}
        >
          <KindIcon className="h-3 w-3" aria-hidden />
          {style.label}
        </span>
        <div className="ms-auto">
          <LensLegend
            inline
            label="Light up bars by kind"
            items={items}
            pinned={pinned}
            onHover={setHovered}
            onPin={setPinned}
          />
        </div>
      </div>

      {/* Two columns when wide, one above the other when not. Each column is a chart and
          the whole-day figure that goes with it, with a thin line between them. */}
      <div className="min-h-0 flex-1 overflow-y-auto pe-1 @[32.5rem]:pt-3">
        {columns.length > 0 && (
          <div
            className={cn(
              "grid gap-y-1.5",
              columns.length > 1 && "@[32.5rem]:grid-cols-2",
              columns.length === 1 && "max-w-md",
            )}
          >
            {columns.map((col, i) => (
              <div
                key={col.key}
                className={cn(
                  "min-w-0 space-y-1.5 @[32.5rem]:space-y-3",
                  i > 0 && "@[32.5rem]:border-s @[32.5rem]:ps-3",
                  i < columns.length - 1 && "@[32.5rem]:pe-3",
                )}
              >
                {col.chart}
                {col.measure}
              </div>
            ))}
          </div>
        )}

        {!hourFindings && !nothing && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">No single hour stood out. The whole day was off.</p>
        )}

        {nothing && <p className="text-[11px] text-muted-foreground">There is nothing to draw for this day.</p>}
      </div>    </div>
  );
}



