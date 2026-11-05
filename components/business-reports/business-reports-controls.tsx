"use client";

import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeekSelect } from "@/components/shared/week-select";
import { AnalyticsControls } from "@/components/maintenance-tickets/analytics/analytics-controls";
import { RANGE_PRESETS, localDay } from "@/lib/maintenance-tickets/local-range";
import {
  businessWeekOptions,
  businessWeekStart,
  clampWeekEnd,
  isWholeWeeks,
  type BusinessWeek,
} from "@/lib/utils/business-week";
import { cn } from "@/lib/utils";
import type { StoreSelection } from "@/types/business-reports.types";
import type { StoreOption } from "./store-multi-select";
import type { DateRange } from "./range-presets";

/** Quick ranges next to the week pickers (the screens analytics bar's pattern). */
const PRESETS = RANGE_PRESETS.filter((p) => p.id === "yesterday" || p.id === "last7" || p.id === "last30");

/**
 * The filter bar, the same as Screen Monitoring's: quick ranges, any dates,
 * From week → To week (Tue–Mon business weeks by week number), stores by store
 * number — then Load (nothing is fetched until then; the page is heavy).
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
}: {
  storeOptions: StoreOption[];
  selection: StoreSelection;
  onSelectionChange: (value: StoreSelection) => void;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onLoad: () => void;
  busy: boolean;
  hasLoaded: boolean;
}) {
  const today = localDay(new Date());
  const weekOptions = useMemo(() => businessWeekOptions(today), [today]);
  const wholeWeeks = isWholeWeeks(range.start, range.end, today);
  const fromWeek = wholeWeeks ? range.start : "";
  const toWeek = wholeWeeks ? businessWeekStart(range.end) : "";

  const pickFromWeek = (week: BusinessWeek) => {
    const keepEnd = wholeWeeks && range.end >= week.start;
    onRangeChange({ start: week.start, end: keepEnd ? range.end : clampWeekEnd(week, today) });
  };
  const pickToWeek = (week: BusinessWeek) => {
    const end = clampWeekEnd(week, today);
    onRangeChange({ start: !wholeWeeks || week.start < range.start ? week.start : range.start, end });
  };

  const hasStores = selection === "all" ? storeOptions.length > 0 : selection.length > 0;
  const validRange = !!range.start && !!range.end && range.start <= range.end;
  const blockedReason = [
    { blocked: !hasStores, reason: "Select at least one store" },
    { blocked: !validRange, reason: "Pick a valid date range" },
  ].find((r) => r.blocked)?.reason;

  return (
    <AnalyticsControls
      storeOptions={storeOptions}
      selection={selection}
      onSelectionChange={onSelectionChange}
      startDate={range.start}
      endDate={range.end}
      onRangeChange={(start, end) => onRangeChange({ start, end })}
      presets={PRESETS}
      weekControls={
        <>
          <WeekSelect weeks={weekOptions} value={fromWeek} onChange={pickFromWeek} placeholder="From week" />
          <WeekSelect weeks={weekOptions} value={toWeek} onChange={pickToWeek} placeholder="To week" />
        </>
      }
    >
      <Button type="button" onClick={onLoad} disabled={Boolean(blockedReason) || busy} title={blockedReason} className="ms-auto">
        <RefreshCw className={cn("me-1.5 h-3.5 w-3.5", busy && "animate-spin")} />
        {hasLoaded ? "Refresh" : "Load"}
      </Button>
    </AnalyticsControls>
  );
}
