"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Parse "HH:mm" (24h) → { hour12, minute, ampm } */
function parse24h(value: string): { hour12: number; minute: number; ampm: "AM" | "PM" } {
  if (!value) return { hour12: 12, minute: 0, ampm: "AM" };
  const [hStr, mStr] = value.split(":");
  const h = Math.max(0, Math.min(23, parseInt(hStr ?? "0", 10)));
  const m = Math.max(0, Math.min(59, parseInt(mStr ?? "0", 10)));
  const ampm: "AM" | "PM" = h < 12 ? "AM" : "PM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { hour12, minute: m, ampm };
}

/** { hour12, minute, ampm } → "HH:mm" (24h) */
function to24h(hour12: number, minute: number, ampm: "AM" | "PM"): string {
  let h = hour12;
  if (ampm === "AM" && hour12 === 12) h = 0;
  else if (ampm === "PM" && hour12 !== 12) h = hour12 + 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  ScrollList sub-component                                           */
/* ------------------------------------------------------------------ */

interface ScrollListProps {
  label: string;
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
  format?: (v: number) => string;
}

function ScrollList({ label, items, selected, onSelect, format }: ScrollListProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selectedRef = React.useRef<HTMLButtonElement>(null);

  // Scroll to selected item when popover opens
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (selectedRef.current && containerRef.current) {
        selectedRef.current.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [selected]);

  // Handle mouse wheel scrolling
  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    if (containerRef.current) {
      const scrollSpeed = 80;
      const direction = e.deltaY > 0 ? 1 : -1;
      containerRef.current.scrollBy({
        top: direction * scrollSpeed,
        behavior: "auto",
      });
    }
  }

  return (
    <div className="flex w-16 flex-col">
      <div className="border-b px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="flex h-44 flex-col gap-0.5 overflow-y-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const isSelected = item === selected;
          const display = format ? format(item) : String(item);
          return (
            <button
              key={item}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "rounded px-1 py-1.5 text-center text-sm font-normal transition-colors",
                isSelected
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {display}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TimePicker                                                         */
/* ------------------------------------------------------------------ */

export interface TimePickerProps {
  /** Current value in 24-hour "HH:mm" format, e.g. "14:30" */
  value: string;
  /** Called with a 24-hour "HH:mm" string whenever the user changes the time */
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = Array.from({ length: 60 }, (_, i) => i);   // 0–59

export function TimePicker({
  value,
  onChange,
  placeholder = "Select time",
  className,
  disabled,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const { hour12, minute, ampm } = parse24h(value);

  const displayLabel = value
    ? `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`
    : placeholder;

  function handleHour(h: number) {
    onChange(to24h(h, minute, ampm));
  }

  function handleMinute(m: number) {
    onChange(to24h(hour12, m, ampm));
  }

  function handleAmpm(ap: "AM" | "PM") {
    onChange(to24h(hour12, minute, ap));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <Clock className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <span className="text-sm">{displayLabel}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0 shadow-lg"
        align="start"
        onInteractOutside={() => setOpen(false)}
      >
        {/* Header */}
        <div className="border-b px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Select Time
          </p>
          {value && (
            <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
              {displayLabel}
            </p>
          )}
        </div>

        {/* Scroll columns */}
        <div className="flex divide-x">
          <ScrollList
            label="Hour"
            items={HOURS}
            selected={hour12}
            onSelect={handleHour}
            format={(v) => String(v)}
          />
          <ScrollList
            label="Min"
            items={MINUTES}
            selected={minute}
            onSelect={handleMinute}
            format={(v) => String(v).padStart(2, "0")}
          />

          {/* AM / PM column */}
          <div className="flex w-16 flex-col">
            <div className="border-b px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
              AM/PM
            </div>
            <div className="flex flex-col gap-1 p-2">
              {(["AM", "PM"] as const).map((ap) => (
                <button
                  key={ap}
                  type="button"
                  onClick={() => handleAmpm(ap)}
                  className={cn(
                    "rounded px-2 py-2 text-sm font-medium transition-colors",
                    ampm === ap
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {ap}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-3 py-2">
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
