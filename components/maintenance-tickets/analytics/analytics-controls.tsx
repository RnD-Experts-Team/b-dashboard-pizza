"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { StoreMultiSelect, type StoreOption } from "@/components/business-reports/store-multi-select";
import type { StoreSelection } from "@/types/business-reports.types";
import { RANGE_PRESETS, matchPreset, presetDays, viewerTimeZone, type RangePreset } from "@/lib/maintenance-tickets/local-range";

/**
 * Which stores, which days. Changes apply at once -- the page is light, and
 * a Load button between the manager and "yesterday" would only be in the way.
 */
export function AnalyticsControls({
  storeOptions,
  selection,
  onSelectionChange,
  startDate,
  endDate,
  onRangeChange,
  disabled,
}: {
  storeOptions: StoreOption[];
  selection: StoreSelection;
  onSelectionChange: (value: StoreSelection) => void;
  startDate: string;
  endDate: string;
  onRangeChange: (startDate: string, endDate: string) => void;
  disabled?: boolean;
}) {
  const active = matchPreset(startDate, endDate);
  const zone = viewerTimeZone();

  function pick(preset: RangePreset) {
    const days = presetDays(preset);
    onRangeChange(days.startDate, days.endDate);
  }

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <StoreMultiSelect options={storeOptions} value={selection} onChange={onSelectionChange} disabled={disabled} />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Date range">
          {RANGE_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={active === p.id ? "default" : "outline"}
              onClick={() => pick(p.id)}
              disabled={disabled}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={cn(active === null && "font-medium text-foreground")}>From</span>
        <DatePicker
          value={startDate}
          onChange={(value) => value && onRangeChange(value, value > endDate ? value : endDate)}
          className="w-36"
          disabled={disabled}
        />
        <span className={cn(active === null && "font-medium text-foreground")}>to</span>
        <DatePicker
          value={endDate}
          onChange={(value) => value && onRangeChange(value < startDate ? value : startDate, value)}
          className="w-36"
          disabled={disabled}
        />
        <span className="inline-flex items-center gap-1" title="Days start and end at midnight in your time zone">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Days in your time{zone ? ` (${zone})` : ""}
        </span>
      </div>
    </div>
  );
}
