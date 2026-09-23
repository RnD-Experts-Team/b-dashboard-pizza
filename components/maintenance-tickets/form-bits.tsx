"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock as ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Small form primitives shared across the maintenance-ticket panels        */
/*                                                                            */
/*  These were module-private inside individual panels. They live here so a   */
/*  panel never has to import from a sibling panel, which would imply a       */
/*  dependency that is not real (an attendance form does not depend on a      */
/*  parts form).                                                             */
/*                                                                            */
/*  They are NOT in components/ui/** — that directory is Core and these are   */
/*  feature-specific compositions of what is already there.                  */
/* ────────────────────────────────────────────────────────────────────────── */

/** Two-option segmented toggle. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-md border overflow-hidden", className)}>
      {options.map((option, i) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
            i > 0 && "border-s",
            value === option.value
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted/60"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[11px] text-destructive">{message}</p>;
}

/**
 * Date + time in one popover.
 *
 * Emits a LOCAL `YYYY-MM-DDTHH:mm` string — no timezone offset. Callers that
 * send it upstream convert with `toRfc3339OrUndefined`; callers that compute a
 * preview should work from this local string directly, so what the user sees
 * and what the preview says cannot drift by an hour across a DST boundary.
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const datePart = value ? value.slice(0, 10) : "";
  const timePart = value ? value.slice(11, 16) : "";
  const selected = datePart ? new Date(datePart + "T00:00") : undefined;

  function handleDateSelect(d: Date | undefined) {
    if (!d) return;
    onChange(`${format(d, "yyyy-MM-dd")}T${timePart || "00:00"}`);
  }
  function handleTimeChange(t: string) {
    onChange(`${datePart || format(new Date(), "yyyy-MM-dd")}T${t}`);
  }

  const displayValue = datePart
    ? `${format(new Date(datePart + "T00:00"), "MMM d, yyyy")}${timePart ? ` ${timePart}` : ""}`
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-8 w-full justify-start text-start text-sm font-normal gap-2",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {displayValue || <span>{placeholder ?? "Pick date & time"}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={selected} onSelect={handleDateSelect} autoFocus />
        <div className="border-t p-3 space-y-2">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              type="time"
              className="h-8 flex-1 text-sm [color-scheme:light] dark:[color-scheme:dark]"
              value={timePart}
              onChange={(e) => handleTimeChange(e.target.value)}
            />
          </div>
          <Button size="sm" className="w-full h-7 text-xs" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Date-only and time-only pickers                                         */
/*                                                                          */
/*  Moved out of ticket-detail-sheet.tsx, where they were module-private     */
/*  alongside a third copy of DateTimePicker. `text-left` became `text-start` */
/*  on the way in: the rest of this app is RTL-ready and those two were the   */
/*  only physical-direction classes left in the feature.                    */
/* ────────────────────────────────────────────────────────────────────────── */

/** Shadcn date picker — Calendar in a Popover */
export function DatePicker({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value + "T00:00") : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-8 w-full justify-start text-start text-sm font-normal gap-2", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {value ? format(new Date(value + "T00:00"), "MMM d, yyyy") : <span>{placeholder ?? "Pick a date"}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => { if (d) { onChange(format(d, "yyyy-MM-dd")); setOpen(false); } }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/** Shadcn time picker — Popover with time Input */
export function TimePicker({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-8 w-full justify-start text-start text-sm font-normal gap-2", !value && "text-muted-foreground", className)}
        >
          <ClockIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {value || <span>{placeholder ?? "Pick a time"}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-3 space-y-2" align="start">
        <p className="text-xs font-medium text-muted-foreground">Select time</p>
        <Input
          type="time"
          className="h-8 text-sm [color-scheme:light] dark:[color-scheme:dark]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
        <Button size="sm" className="w-full h-7 text-xs" onClick={() => setOpen(false)}>Done</Button>
      </PopoverContent>
    </Popover>
  );
}

// (The sheet's own third copy of DateTimePicker came along with this move
//  and was deleted here -- the exported one above is byte-for-byte the same
//  component, and three implementations of one picker was the problem.)
