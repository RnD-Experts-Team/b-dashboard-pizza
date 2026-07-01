"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import type { StoreSelection } from "@/types/business-reports.types";
import { StoreMultiSelect, type StoreOption } from "./store-multi-select";

interface BusinessReportsControlsProps {
  storeOptions: StoreOption[];
  selection: StoreSelection;
  onSelectionChange: (value: StoreSelection) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  onLoad: () => void;
  isLoading: boolean;
  /** True once the first load has completed — switches the button label. */
  hasLoaded: boolean;
}

/**
 * Header controls for the Business Reports page: store multi-select, a
 * start/end date range, and a manual Load / Refresh trigger. Nothing fetches
 * until the button is clicked (this page is heavy).
 */
export function BusinessReportsControls({
  storeOptions,
  selection,
  onSelectionChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onLoad,
  isLoading,
  hasLoaded,
}: BusinessReportsControlsProps) {
  const hasStores = selection === "all" || selection.length > 0;
  const validRange =
    !!startDate && !!endDate && startDate <= endDate;
  const canLoad = hasStores && validRange && !isLoading;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StoreMultiSelect
        options={storeOptions}
        value={selection}
        onChange={onSelectionChange}
        disabled={isLoading}
      />

      <DatePicker
        value={startDate}
        onChange={onStartDateChange}
        placeholder="Start date"
        disabled={isLoading}
        className="w-40"
      />
      <DatePicker
        value={endDate}
        onChange={onEndDateChange}
        placeholder="End date"
        disabled={isLoading}
        className="w-40"
      />

      <Button
        type="button"
        size="sm"
        onClick={onLoad}
        disabled={!canLoad}
        title={
          !hasStores
            ? "Select at least one store"
            : !validRange
              ? "Pick a valid date range"
              : undefined
        }
      >
        <RefreshCw className={cn("me-2 h-4 w-4", isLoading && "animate-spin")} />
        {hasLoaded ? "Refresh" : "Load"}
      </Button>
    </div>
  );
}
