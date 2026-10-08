"use client";

import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { StoreMultiSelect, type StoreOption } from "@/components/business-reports/store-multi-select";
import type { StoreSelection } from "@/types/business-reports.types";
import { RANGE_PRESETS, matchPreset, presetDays, type RangePreset } from "@/lib/maintenance-tickets/local-range";

/**
 * The filter bar: which days, which stores -- one row, applied at once.
 *
 * The presets are a segmented control; picking your own dates simply leaves
 * none of them lit, and the dates say the range. Which time zone the days are counted in is
 * said in the page subtitle, because "yesterday" means YOUR yesterday.
 */
export function AnalyticsControls({
  storeOptions,
  selection,
  onSelectionChange,
  startDate,
  endDate,
  onRangeChange,
  isUpdating,
  presets = RANGE_PRESETS,
  children,
}: {
  storeOptions: StoreOption[];
  selection: StoreSelection;
  onSelectionChange: (value: StoreSelection) => void;
  startDate: string;
  endDate: string;
  onRangeChange: (startDate: string, endDate: string) => void;
  /** A reload is in flight -- the controls stay usable, the bar says so. */
  isUpdating?: boolean;
  /** The preset buttons; the analytics page's by default. */
  presets?: { id: RangePreset; label: string }[];
  /** More filters, after the stores. */
  children?: ReactNode;
}) {
  const active = matchPreset(startDate, endDate, undefined, presets);

  function pick(preset: RangePreset) {
    const days = presetDays(preset);
    onRangeChange(days.startDate, days.endDate);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div role="group" aria-label="Date range" className="inline-flex flex-wrap rounded-lg border bg-muted/50 p-0.5">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={active === p.id}
            onClick={() => pick(p.id)}
            className={cn(
              "cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === p.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label.replace(/^Last /, "")}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">From</span>
        <DatePicker
          value={startDate}
          onChange={(value) => value && onRangeChange(value, value > endDate ? value : endDate)}
          className="w-36"
        />
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">To</span>
        <DatePicker
          value={endDate}
          onChange={(value) => value && onRangeChange(value < startDate ? value : startDate, value)}
          className="w-36"
        />
      </div>

      <StoreMultiSelect options={storeOptions} value={selection} onChange={onSelectionChange} className="w-48" />

      {children}

      {isUpdating && (
        <span className="ms-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Updating…
        </span>
      )}
    </div>
  );
}
