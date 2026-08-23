"use client";

import { useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { CalendarIcon, Loader2, RefreshCw, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const TREND_WEEK_OPTIONS = [4, 6, 8, 12] as const;

interface LaborHeaderProps {
  storeNumber: string | null;
  selectedDate: Date;
  onSelectedDateChange: (date: Date) => void;
  trendWeeks: number;
  onTrendWeeksChange: (weeks: number) => void;
  /** From the response — the business week the API snapped the date to. */
  weekStart?: string;
  weekEnd?: string;
  isLoading: boolean;
  onRefresh: () => void;
}

/** Matches the DSPR V1 dashboard's compact badge-and-icon-button header bar. */
export function LaborHeader({
  storeNumber,
  selectedDate,
  onSelectedDateChange,
  trendWeeks,
  onTrendWeeksChange,
  weekStart,
  weekEnd,
  isLoading,
  onRefresh,
}: LaborHeaderProps) {
  const [dateOpen, setDateOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs font-medium">
        <Store className="h-3.5 w-3.5" />
        {storeNumber ? `Store ${storeNumber}` : "No store selected"}
      </Badge>

      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 gap-1 text-xs font-medium">
            <CalendarIcon className="h-3 w-3" />
            {format(selectedDate, "MMM d, yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (!date) return;
              onSelectedDateChange(date);
              setDateOpen(false);
            }}
            disabled={(date) => date > subDays(new Date(), 1)}
            defaultMonth={selectedDate}
          />
        </PopoverContent>
      </Popover>

      {/* Only shown once the response lands — the picker sends any day and
          the API decides which Tuesday→Monday week that falls in. */}
      {weekStart && weekEnd && (
        <Badge variant="outline" className="gap-1 px-2.5 py-1 text-xs">
          <CalendarIcon className="h-3 w-3" />
          Week of {format(parseISO(weekStart), "MMM d")}
          <span className="text-muted-foreground">
            → {format(parseISO(weekEnd), "MMM d")}
          </span>
        </Badge>
      )}

      <div className="flex-1" />

      <Select
        value={String(trendWeeks)}
        onValueChange={(v) => onTrendWeeksChange(Number(v))}
      >
        <SelectTrigger size="sm" className="h-6 w-auto gap-1 px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {TREND_WEEK_OPTIONS.map((w) => (
            <SelectItem key={w} value={String(w)}>
              {w} weeks trend
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isLoading ? "Refreshing…" : "Refresh report"}</TooltipContent>
      </Tooltip>
    </div>
  );
}
