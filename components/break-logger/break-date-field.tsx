"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/*
 * A WORK-date picker (`YYYY-MM-DD`) on the shadcn Calendar.
 *
 * Unlike the generic `ui/date-picker`, it takes `min` / `max` and greys out
 * everything outside them — the breaks API only has days from the retention
 * horizon up to today, and a picker that lets you choose tomorrow and then
 * silently shows today is exactly the confusion this replaces.
 *
 * Work dates are bare calendar strings, so they're mapped to LOCAL midnight
 * and back with local getters: no time-zone shift in either direction.
 */

function toDate(value: string | null | undefined): Date | undefined {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

function toIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function BreakDateField({
  id,
  value,
  onChange,
  min,
  max,
  placeholder,
  className,
  ariaLabel,
}: {
  id?: string;
  /** `YYYY-MM-DD`, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable work date (inclusive). */
  min?: string | null;
  /** Latest selectable work date (inclusive). */
  max?: string | null;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const selected = toDate(value);
  const fromDay = toDate(min);
  const toDay = toDate(max);

  const display = selected
    ? new Intl.DateTimeFormat(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(selected)
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className={cn(
            "h-9 justify-start gap-2 text-start font-normal tabular-nums",
            !display && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" />
          <span className="truncate">{display || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" collisionPadding={8}>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? toDay}
          onSelect={(d) => {
            if (!d) return;
            onChange(toIso(d));
            setOpen(false);
          }}
          disabled={[
            ...(fromDay ? [{ before: fromDay }] : []),
            ...(toDay ? [{ after: toDay }] : []),
          ]}
          startMonth={fromDay}
          endMonth={toDay}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
