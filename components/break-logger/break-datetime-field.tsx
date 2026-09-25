"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/*
 * Date + time for a break, on the shadcn Calendar instead of the browser's
 * native datetime-local popup (which ignores the theme and differs per browser).
 *
 * Speaks the same LOCAL `YYYY-MM-DDTHH:mm` string the form already stores, so
 * `localInputToIso` / `isoToLocalInput` keep doing the conversion.
 */

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const pad = (n: number) => String(n).padStart(2, "0");

function split(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return { y, mo, d, h, mi };
}

function join(date: Date, h24: number, minute: number) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(h24)}:${pad(minute)}`;
}

/** `YYYY-MM-DD…` → local midnight, for the Calendar's `disabled` bounds. */
function dayOf(value: string | undefined): Date | undefined {
  const p = value ? split(value.length === 10 ? `${value}T00:00` : value) : null;
  return p ? new Date(p.y, p.mo - 1, p.d) : undefined;
}

/** Localised AM/PM labels (ص/م in Arabic). */
function useDayPeriods(locale: string): [string, string] {
  return useMemo(() => {
    const label = (h: number) =>
      new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: true })
        .formatToParts(new Date(2000, 0, 1, h))
        .find((p) => p.type === "dayPeriod")?.value ?? (h < 12 ? "AM" : "PM");
    return [label(9), label(21)];
  }, [locale]);
}

function TimeColumn({
  label,
  items,
  selected,
  format,
  onSelect,
  open,
}: {
  label: string;
  items: number[];
  selected: number | null;
  format: (n: number) => string;
  onSelect: (n: number) => void;
  open: boolean;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Bring the current value into view each time the popover opens.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() =>
      selectedRef.current?.scrollIntoView({ block: "center" })
    );
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return (
    <div
      role="listbox"
      aria-label={label}
      // Dialog's scroll lock swallows wheel events inside portaled popovers.
      onWheel={(e) => e.stopPropagation()}
      className="flex h-full w-14 flex-col gap-0.5 overflow-y-auto p-1 [scrollbar-width:thin]"
    >
      {items.map((n) => {
        const isSelected = n === selected;
        return (
          <button
            key={n}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(n)}
            className={cn(
              "shrink-0 rounded-md py-1.5 text-center text-sm tabular-nums transition-colors",
              isSelected
                ? "bg-primary font-medium text-primary-foreground"
                : "hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {format(n)}
          </button>
        );
      })}
    </div>
  );
}

export function BreakDateTimeField({
  id,
  value,
  onChange,
  min,
  max,
  invalid,
  describedBy,
}: {
  id?: string;
  /** Local `YYYY-MM-DDTHH:mm`, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable day (only the date part is used). */
  min?: string;
  /** Latest selectable day (only the date part is used). */
  max?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("breaks.entry");
  const locale = useLocale();
  const [am, pm] = useDayPeriods(locale);
  const [open, setOpen] = useState(false);

  const parts = split(value);
  const selectedDay = parts ? new Date(parts.y, parts.mo - 1, parts.d) : undefined;
  const h24 = parts?.h ?? null;
  const minute = parts?.mi ?? null;
  const hour12 = h24 == null ? null : h24 % 12 || 12;
  const isPm = h24 != null && h24 >= 12;

  const fromDay = dayOf(min);
  const toDay = dayOf(max);

  const display = parts
    ? new Intl.DateTimeFormat(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi))
    : "";

  const baseDay = () => selectedDay ?? toDay ?? new Date();
  const setTime = (nextH24: number, nextMinute: number) =>
    onChange(join(baseDay(), nextH24, nextMinute));

  function pickHour(h12: number) {
    const pmNow = h24 != null ? isPm : false;
    setTime((h12 % 12) + (pmNow ? 12 : 0), minute ?? 0);
  }
  function pickPeriod(toPm: boolean) {
    const h = h24 ?? 0;
    setTime((h % 12) + (toPm ? 12 : 0), minute ?? 0);
  }
  function setNow() {
    const now = new Date();
    onChange(join(now, now.getHours(), now.getMinutes()));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(
            "h-9 w-full justify-start gap-2 text-start font-normal tabular-nums",
            !display && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" />
          <span className="truncate">{display || t("pickDateTime")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            selected={selectedDay}
            defaultMonth={selectedDay ?? toDay}
            onSelect={(d) => d && onChange(join(d, h24 ?? 0, minute ?? 0))}
            disabled={[
              ...(fromDay ? [{ before: fromDay }] : []),
              ...(toDay ? [{ after: toDay }] : []),
            ]}
            startMonth={fromDay}
            endMonth={toDay}
          />
          {/* Absolutely filled so the columns match the calendar's height and scroll. */}
          <div className="relative h-56 border-t sm:h-auto sm:w-42 sm:border-s sm:border-t-0">
            <div className="absolute inset-0 flex justify-center">
              <TimeColumn
                label={t("hour")}
                items={HOURS}
                selected={hour12}
                format={pad}
                onSelect={pickHour}
                open={open}
              />
              <TimeColumn
                label={t("minute")}
                items={MINUTES}
                selected={minute}
                format={pad}
                onSelect={(m) => setTime(h24 ?? 0, m)}
                open={open}
              />
              <div role="listbox" aria-label={t("period")} className="flex w-14 flex-col gap-0.5 p-1">
                {[false, true].map((toPm) => {
                  const isSelected = h24 != null && isPm === toPm;
                  return (
                    <button
                      key={String(toPm)}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => pickPeriod(toPm)}
                      className={cn(
                        "rounded-md py-1.5 text-center text-sm transition-colors",
                        isSelected
                          ? "bg-primary font-medium text-primary-foreground"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {toPm ? pm : am}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button type="button" variant="ghost" size="sm" onClick={setNow}>
            {t("now")}
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            {t("done")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
