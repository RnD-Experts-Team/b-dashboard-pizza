"use client";

import type { ReactNode } from "react";
import { ArrowDownUp, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Basis } from "@/lib/scheduling/day-plan";

/**
 * What an odd day is and how it is drawn, in one place, so the calendar, its
 * legend, the day chart and the text list can never drift apart.
 *
 * Nothing here is a new colour. They are the DSPR dashboard's own: the `Delta`
 * pill's emerald for up and red for down (`-600` text with a `dark:-400` pair,
 * `-500` for bars and fills), its info blue for "both", and the shared neutral
 * tokens for everything else. The arrows say the same thing as the colours, so
 * red and green are never the only cue.
 */

export type Kind = "spike" | "dip" | "mixed";

/** What a legend item can light up on the calendar. */
export type CalendarLens = Kind | "normal";

interface KindStyle {
  label: string;
  icon: LucideIcon;
  /** Arrows and any coloured text. */
  text: string;
  /** Bars and swatches. */
  bar: string;
  /** A pale fill, for pills. */
  soft: string;
  /** The ring that marks a day as lit by the legend. */
  ring: string;
  /** One plain sentence on what it means. */
  hint: string;
}

export const KINDS: Record<Kind, KindStyle> = {
  spike: {
    label: "Above usual",
    icon: TrendingUp,
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    soft: "bg-emerald-500/15",
    ring: "ring-emerald-500/60",
    hint: "Sales or people on the clock ran higher than a normal week.",
  },
  dip: {
    label: "Below usual",
    icon: TrendingDown,
    text: "text-red-600 dark:text-red-400",
    bar: "bg-red-500",
    soft: "bg-red-500/15",
    ring: "ring-red-500/60",
    hint: "Sales or people on the clock ran lower than a normal week.",
  },
  mixed: {
    label: "Both",
    icon: ArrowDownUp,
    text: "text-blue-600 dark:text-blue-400",
    bar: "bg-blue-500",
    soft: "bg-blue-500/15",
    ring: "ring-blue-500/60",
    hint: "Higher than usual at some hours and lower at others, on the same day.",
  },
};

/** The line under the calendar legend: what to look at, and what happens to those days. */
export function lensHelp(lens: CalendarLens | null, basis: Basis): string {
  if (lens === null) return "Click a day with an arrow to see its hours.";
  if (lens === "normal") return "Normal: nothing unusual, so these days are always in the averages.";
  const status = basis === "typical" ? "Left out of the averages." : "Counted in the averages.";
  return `${KINDS[lens].label}: ${KINDS[lens].hint} ${status}`;
}

/* ── The legend, as a lens ──────────────────────────────────────────────── */

export interface LegendItem<K extends string> {
  key: K;
  label: string;
  /** The little mark that matches this kind on the chart. */
  mark: ReactNode;
  count?: number;
}

/**
 * Hover or focus an item and `onHover` reports it, so the chart can light up
 * what it stands for and fade the rest. Pressing pins it (`aria-pressed`), which
 * is the only way to use it on a touch screen; pressing again lets go.
 */
export function LensLegend<K extends string>({
  items,
  pinned,
  onHover,
  onPin,
  label,
  inline = false,
}: {
  items: readonly LegendItem<K>[];
  pinned: K | null;
  onHover: (key: K | null) => void;
  onPin: (key: K | null) => void;
  label: string;
  /**
   * Always a row of small chips. Otherwise it is a row while its container is
   * narrow and a list with the day counts at the end once it is wide (`@lg`),
   * so it must sit inside an `@container`.
   */
  inline?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex flex-wrap items-center gap-x-1 gap-y-0.5",
        !inline && "@lg:flex-col @lg:items-stretch @lg:gap-x-0",
      )}
    >
      {items.map((item) => {
        const on = pinned === item.key;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            // A finger resting on the screen is not hovering, and would leave the lens stuck.
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") onHover(item.key);
            }}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(item.key)}
            onBlur={() => onHover(null)}
            onClick={() => onPin(on ? null : item.key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              !inline && "@lg:w-full @lg:py-1",
              on && "bg-muted font-medium",
            )}
          >
            {item.mark}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className="ms-auto ps-1 tabular-nums text-muted-foreground">
                {item.count}
                <span className="hidden @lg:inline"> {item.count === 1 ? "day" : "days"}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
