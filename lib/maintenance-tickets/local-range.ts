import { addDays, format, parseISO, startOfDay, subDays } from "date-fns";

/**
 * Date ranges for the maintenance analytics page, in the VIEWER'S clock.
 *
 * The owner's rule: "yesterday" is the viewer's yesterday. The API stores UTC,
 * so the page turns its own local midnights into UTC instants and sends those
 * -- a ticket filed at 11:30 PM local time lands on the right day, whatever
 * the offset. Days are picked as "YYYY-MM-DD" strings (local, both ends
 * included) and converted only at the edge, here.
 */

export type RangePreset = "yesterday" | "today" | "last7" | "last30";

export const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: "yesterday", label: "Yesterday" },
  { id: "today", label: "Today" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
];

/** Local calendar day as "YYYY-MM-DD". */
export function localDay(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** The inclusive local-day range a preset means, relative to `now`. */
export function presetDays(preset: RangePreset, now: Date = new Date()): { startDate: string; endDate: string } {
  const today = startOfDay(now);
  switch (preset) {
    case "today":
      return { startDate: localDay(today), endDate: localDay(today) };
    case "last7":
      return { startDate: localDay(subDays(today, 6)), endDate: localDay(today) };
    case "last30":
      return { startDate: localDay(subDays(today, 29)), endDate: localDay(today) };
    case "yesterday":
    default: {
      const y = subDays(today, 1);
      return { startDate: localDay(y), endDate: localDay(y) };
    }
  }
}

/**
 * Inclusive local days → the half-open instant range the API wants:
 * from = local midnight starting `startDate`, to = local midnight after
 * `endDate`, both as UTC ISO strings. Null when either day does not parse
 * or the range runs backwards.
 */
export function daysToInstants(startDate: string, endDate: string): { from: string; to: string } | null {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;

  return {
    from: startOfDay(start).toISOString(),
    to: startOfDay(addDays(end, 1)).toISOString(),
  };
}

/** Which preset (if any) an inclusive day range is, for highlighting its button. */
export function matchPreset(startDate: string, endDate: string, now: Date = new Date()): RangePreset | null {
  for (const { id } of RANGE_PRESETS) {
    const days = presetDays(id, now);
    if (days.startDate === startDate && days.endDate === endDate) return id;
  }
  return null;
}

/** The viewer's time zone, for saying which clock the page counts days in. */
export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}
