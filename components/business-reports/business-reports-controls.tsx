"use client";

import { CalendarRange, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { StoreSelection } from "@/types/business-reports.types";
import { StoreMultiSelect, type StoreOption } from "./store-multi-select";
import {
  RANGE_PRESETS,
  matchPreset,
  presetRange,
  type DateRange,
  type RangePresetKey,
} from "./range-presets";

const CUSTOM = "custom";

interface BusinessReportsControlsProps {
  storeOptions: StoreOption[];
  selection: StoreSelection;
  onSelectionChange: (value: StoreSelection) => void;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onLoad: () => void;
  busy: boolean;
  hasLoaded: boolean;
}

/**
 * Header controls: stores, a business-calendar quick range (or any custom
 * dates), and Load. Nothing is fetched until Load — the page is heavy.
 */
export function BusinessReportsControls({
  storeOptions,
  selection,
  onSelectionChange,
  range,
  onRangeChange,
  onLoad,
  busy,
  hasLoaded,
}: BusinessReportsControlsProps) {
  const hasStores = selection === "all" ? storeOptions.length > 0 : selection.length > 0;
  const validRange = !!range.start && !!range.end && range.start <= range.end;
  const preset = matchPreset(range) ?? CUSTOM;
  const blockedReason = [
    { blocked: !hasStores, reason: "Select at least one store" },
    { blocked: !validRange, reason: "Pick a valid date range" },
  ].find((r) => r.blocked)?.reason;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StoreMultiSelect
        options={storeOptions}
        value={selection}
        onChange={onSelectionChange}
        className="h-9 w-44"
      />

      <Select
        value={preset}
        onValueChange={(v) => {
          if (v !== CUSTOM) onRangeChange(presetRange(v as RangePresetKey));
        }}
      >
        <SelectTrigger className="w-40 text-xs">
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_PRESETS.map((p) => (
            <SelectItem key={p.key} value={p.key} className="text-xs">
              {p.label}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM} className="text-xs">
            Custom range
          </SelectItem>
        </SelectContent>
      </Select>

      <DatePicker
        value={range.start}
        onChange={(start) => onRangeChange({ ...range, start })}
        placeholder="Start date"
        className="w-36"
      />
      <span className="text-xs text-muted-foreground">→</span>
      <DatePicker
        value={range.end}
        onChange={(end) => onRangeChange({ ...range, end })}
        placeholder="End date"
        className="w-36"
      />

      <Button
        type="button"
        onClick={onLoad}
        disabled={Boolean(blockedReason) || busy}
        title={blockedReason}
      >
        <RefreshCw className={cn("me-1.5 h-3.5 w-3.5", busy && "animate-spin")} />
        {hasLoaded ? "Refresh" : "Load"}
      </Button>
    </div>
  );
}
