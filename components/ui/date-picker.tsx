"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Parse "YYYY-MM-DD" string to a local Date (avoids UTC offset shift) */
function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, (m as number) - 1, d);
  if (isNaN(date.getTime())) return undefined;
  return date;
}

/** Format a local Date to "YYYY-MM-DD" */
function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Try to parse a user-typed/pasted date string into a local Date.
 * Supports: YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY, MM-DD-YYYY,
 *           "May 7, 2026", "May 7 2026", "7 May 2026"
 */
function parseFlexibleDate(raw: string): Date | undefined {
  const s = raw.trim();
  if (!s) return undefined;

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch.map(Number);
    const date = new Date(y as number, (m as number) - 1, d as number);
    if (!isNaN(date.getTime())) return date;
  }

  // MM/DD/YYYY or MM-DD-YYYY
  const mdyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch.map(Number);
    const date = new Date(y as number, (m as number) - 1, d as number);
    if (!isNaN(date.getTime())) return date;
  }

  // "May 7, 2026" / "May 7 2026" / "7 May 2026"
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const wordsMatch = s.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/) ||
                     s.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (wordsMatch) {
    let monthStr: string, dayNum: number, yearNum: number;
    if (/^\d/.test(wordsMatch[1] ?? "")) {
      dayNum = parseInt(wordsMatch[1] ?? "0", 10);
      monthStr = (wordsMatch[2] ?? "").toLowerCase().slice(0, 3);
      yearNum = parseInt(wordsMatch[3] ?? "0", 10);
    } else {
      monthStr = (wordsMatch[1] ?? "").toLowerCase().slice(0, 3);
      dayNum = parseInt(wordsMatch[2] ?? "0", 10);
      yearNum = parseInt(wordsMatch[3] ?? "0", 10);
    }
    const monthIdx = months[monthStr];
    if (monthIdx !== undefined) {
      const date = new Date(yearNum, monthIdx, dayNum);
      if (!isNaN(date.getTime())) return date;
    }
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export interface DatePickerProps {
  /** Current value in "YYYY-MM-DD" format, or empty string for no selection */
  value: string;
  /** Called with "YYYY-MM-DD" string when the user picks a date */
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Minimum selectable year (inclusive). Defaults to 1900. */
  fromYear?: number;
  /** Maximum selectable year (inclusive). Defaults to current year + 10. */
  toYear?: number;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "YYYY-MM-DD",
  className,
  disabled,
  fromYear = 1900,
  toYear = new Date().getFullYear() + 10,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    if (!isEditing) {
      setInputValue(value);
    }
  }, [isEditing, value]);

  const selected = React.useMemo(() => {
    if (inputValue.trim()) {
      return parseFlexibleDate(inputValue) ?? parseIsoDate(value);
    }

    return parseIsoDate(value);
  }, [inputValue, value]);

  function commitInputValue(raw: string) {
    const trimmed = raw.trim();

    if (!trimmed) {
      onChange("");
      setInputValue("");
      return;
    }

    const parsed = parseFlexibleDate(trimmed);
    if (!parsed) {
      setInputValue(value);
      return;
    }

    const year = parsed.getFullYear();
    if (year < fromYear || year > toYear) {
      setInputValue(value);
      return;
    }

    const iso = formatIsoDate(parsed);
    onChange(iso);
    setInputValue(iso);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
  }

  function handleInputBlur() {
    setIsEditing(false);
    commitInputValue(inputValue);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitInputValue(inputValue);
      e.currentTarget.blur();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setInputValue(value);
      e.currentTarget.blur();
    }
  }

  function handleSelect(date: Date | undefined) {
    if (date) {
      const iso = formatIsoDate(date);
      onChange(iso);
      setInputValue(iso);
      setIsEditing(false);
      setOpen(false);
    }
  }

  return (
    <div className={cn("flex h-9", className)}>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsEditing(true)}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="rounded-r-none border-r-0 h-9 text-sm"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-9 rounded-l-none border-l-0 px-2.5 shrink-0"
          >
            <CalendarIcon className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            captionLayout="dropdown"
            defaultMonth={selected}
            fromYear={fromYear}
            toYear={toYear}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
