/**
 * Presentation constants and pure display helpers for the scheduling feature.
 *
 * Split out of the old `lib/scheduling/data.ts`, which mixed these with mock
 * records. The mocks now live in `dev-fixtures.ts` and are deleted once the
 * OperationsPizza API is wired in.
 */

export const DAYS_OF_WEEK = [
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "Monday",
] as const;

export const DAYS_SHORT = [
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
  "Mon",
] as const;

export const SHIFT_PRESETS = [
  { label: "Morning", type: "morning" as const, startTime: "08:00", endTime: "16:00" },
  { label: "Evening", type: "evening" as const, startTime: "16:00", endTime: "22:00" },
  { label: "Night", type: "night" as const, startTime: "22:00", endTime: "06:00" },
  { label: "Split AM", type: "split" as const, startTime: "10:00", endTime: "14:00" },
  { label: "Split PM", type: "split" as const, startTime: "17:00", endTime: "21:00" },
] as const;

export const EMPLOYEE_COLORS: Record<string, { bg: string; border: string; text: string; hoverBg: string }> = {
  blue: { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", hoverBg: "hover:bg-blue-100 dark:hover:bg-blue-950/60" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", hoverBg: "hover:bg-emerald-100 dark:hover:bg-emerald-950/60" },
  violet: { bg: "bg-violet-50 dark:bg-violet-950/40", border: "border-violet-200 dark:border-violet-800", text: "text-violet-700 dark:text-violet-300", hoverBg: "hover:bg-violet-100 dark:hover:bg-violet-950/60" },
  amber: { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", hoverBg: "hover:bg-amber-100 dark:hover:bg-amber-950/60" },
  rose: { bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800", text: "text-rose-700 dark:text-rose-300", hoverBg: "hover:bg-rose-100 dark:hover:bg-rose-950/60" },
  cyan: { bg: "bg-cyan-50 dark:bg-cyan-950/40", border: "border-cyan-200 dark:border-cyan-800", text: "text-cyan-700 dark:text-cyan-300", hoverBg: "hover:bg-cyan-100 dark:hover:bg-cyan-950/60" },
  orange: { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300", hoverBg: "hover:bg-orange-100 dark:hover:bg-orange-950/60" },
  pink: { bg: "bg-pink-50 dark:bg-pink-950/40", border: "border-pink-200 dark:border-pink-800", text: "text-pink-700 dark:text-pink-300", hoverBg: "hover:bg-pink-100 dark:hover:bg-pink-950/60" },
  indigo: { bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-300", hoverBg: "hover:bg-indigo-100 dark:hover:bg-indigo-950/60" },
  teal: { bg: "bg-teal-50 dark:bg-teal-950/40", border: "border-teal-200 dark:border-teal-800", text: "text-teal-700 dark:text-teal-300", hoverBg: "hover:bg-teal-100 dark:hover:bg-teal-950/60" },
};

/**
 * Fallback overtime threshold, in hours.
 *
 * The API supplies the real value per store as `store.overtime_threshold_hours`;
 * this is only the default used before a store's settings have loaded.
 */
export const DEFAULT_OVERTIME_THRESHOLD = 40;

/** Format 24h time string to 12h display */
export function formatTime(time: string): string {
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr;
  if (h === 0) return `12:${m} AM`;
  if (h === 12) return `12:${m} PM`;
  if (h > 12) return `${h - 12}:${m} PM`;
  return `${h}:${m} AM`;
}

/**
 * Hours between two "HH:mm" times, wrapping past midnight.
 *
 * ⚠️ Wall-clock arithmetic — it is wrong on the two DST changeover days, in the
 * direction that UNDERPAYS staff (22:00→06:00 is 9 hours on the November
 * fall-back night, not 8). Never use it for a saved shift's hours: the API
 * returns an authoritative `durationMinutes` on every shift and actual shift.
 *
 * Legitimate uses, and only these:
 *   1. Live duration preview in the add/edit dialogs, where the user is typing
 *      times that have no server-computed duration yet.
 *   2. The parked day/month views (see the banner in those files).
 */
export function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60; // wrap past midnight
  return (endMin - startMin) / 60;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Time-axis geometry — PARKED CODE ONLY                                    */
/*                                                                           */
/*  Consumed solely by the parked `day-view.tsx` / `month-overview.tsx`. The  */
/*  live week grid is a <table> and has no time axis, so the hardcoded        */
/*  9am–midnight window below is not a correctness problem today. If day view */
/*  is ever revived, these must be driven by the store's real open/close      */
/*  hours (`store.open_time` / `store.close_time` from the API) instead.      */
/* ────────────────────────────────────────────────────────────────────────── */

/** Grid time axis starts at 9 AM (hour 9) and ends at 12 AM (hour 24) → 15 hours */
export const GRID_START_HOUR = 9;
export const GRID_END_HOUR = 24; // represents midnight (00:00)
const GRID_TOTAL_HOURS = GRID_END_HOUR - GRID_START_HOUR; // 15

/** Time labels for the left axis (9 AM through 12 AM) */
export function getTimeLabels(): string[] {
  const labels: string[] = [];
  for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) {
    const hour = h === 24 ? 0 : h; // 24 → midnight display
    labels.push(formatTime(`${String(hour).padStart(2, "0")}:00`));
  }
  return labels;
}

/**
 * Convert a time string to a top-% offset within the grid.
 * "09:00" → 0%, "00:00" (midnight) → 100%.
 */
function timeToPercent(time: string): number {
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  // Treat midnight (0:00) as 24:00
  if (h === 0 && m === 0) h = 24;
  const minutesFromStart = (h - GRID_START_HOUR) * 60 + m;
  const totalMinutes = GRID_TOTAL_HOURS * 60;
  return Math.max(0, Math.min(100, (minutesFromStart / totalMinutes) * 100));
}

/**
 * Convert a time range to { top%, height% } within the grid.
 */
export function shiftToPosition(
  startTime: string,
  endTime: string
): { top: number; height: number } {
  const top = timeToPercent(startTime);
  const bottom = timeToPercent(endTime);
  return { top, height: Math.max(bottom - top, 2) }; // min 2% so tiny shifts are visible
}
