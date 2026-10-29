"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { filterWeeks, parseWeekQuery, toBusinessWeek, weekFromNumber, type BusinessWeek } from "@/lib/utils/business-week";

/**
 * Picks one Tuesday→Monday week: scroll the list, or type "43 2026" / "43/26" / "43"
 * to filter it and press Enter. A typed week/year outside the list (older than it)
 * still works. `weeks` is newest first; nothing newer than its first entry can be picked.
 * `value` is the week's Tuesday ("" = none lit). `compact` matches the small h-6 header controls.
 */
export function WeekSelect({
  weeks,
  value,
  onChange,
  placeholder,
  compact = false,
  className,
}: {
  weeks: BusinessWeek[];
  value: string;
  onChange: (week: BusinessWeek) => void;
  placeholder: string;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const found = filterWeeks(weeks, query);
    // A fully typed week + year that the list doesn't hold (older than it) is still reachable.
    const { week, year } = parseWeekQuery(query);
    const exact = week !== undefined && year !== undefined ? weekFromNumber(week, year) : null;
    const latest = weeks[0]?.start;
    if (exact && latest && exact.start <= latest && !found.some((w) => w.start === exact.start)) {
      return [exact, ...found];
    }
    return found;
  }, [weeks, query]);

  function pick(week: BusinessWeek) {
    onChange(week);
    setOpen(false);
  }

  return (
    <div className={cn("inline-flex items-center", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={placeholder}
            className={cn(
              compact ? "h-6 gap-1 px-2 text-xs font-medium" : "h-9 w-40 justify-between px-3 text-sm font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <span className="inline-flex items-center gap-1">
              <CalendarDays className={compact ? "size-3" : "size-4"} aria-hidden="true" />
              {value ? toBusinessWeek(value).label : placeholder}
            </span>
            {!compact && <ChevronDown className="size-4 opacity-50" aria-hidden="true" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-1.5" align="start">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) {
                e.preventDefault();
                pick(matches[0]);
              }
            }}
            placeholder="Type week & year, e.g. 43 2026"
            aria-label="Find a week"
            className="mb-1 h-7 text-xs"
          />
          <div className="max-h-64 overflow-y-auto" role="listbox">
            {matches.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">No such week</p>
            ) : (
              matches.map((w) => (
                <button
                  key={w.start}
                  type="button"
                  role="option"
                  aria-selected={w.start === value}
                  ref={(el) => {
                    if (el && w.start === value && !query) el.scrollIntoView({ block: "center" });
                  }}
                  onClick={() => pick(w)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-start hover:bg-accent hover:text-accent-foreground",
                    compact ? "text-xs" : "text-sm",
                    w.start === value && "bg-accent/60 font-medium",
                  )}
                >
                  {w.label}
                  {w.start === value && <Check className="size-3.5" aria-hidden="true" />}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
