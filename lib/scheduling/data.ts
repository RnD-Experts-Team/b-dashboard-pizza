import type { ScheduleEmployee, Shift, AvailabilityRule, TimeOffEntry, ActualShift } from "@/types/scheduling.types";

export const DUMMY_EMPLOYEES: ScheduleEmployee[] = [
  { id: "emp-1", name: "Marco Rossi", role: "Pizzaiolo", department: "Kitchen", avatar: "MR", color: "blue" },
  { id: "emp-2", name: "Sofia Kim", role: "Cashier", department: "Front of House", avatar: "SK", color: "emerald" },
  { id: "emp-3", name: "Leo Jenkins", role: "Head Chef", department: "Kitchen", avatar: "LJ", color: "violet" },
  { id: "emp-4", name: "Elena Patel", role: "Prep Cook", department: "Kitchen", avatar: "EP", color: "amber" },
  { id: "emp-5", name: "David Chen", role: "Delivery Driver", department: "Delivery", avatar: "DC", color: "rose" },
  { id: "emp-6", name: "Maria Rodriguez", role: "Server", department: "Front of House", avatar: "MG", color: "cyan" },
  { id: "emp-7", name: "James Carter", role: "Line Cook", department: "Kitchen", avatar: "JC", color: "orange" },
  { id: "emp-8", name: "Aisha Noor", role: "Delivery Driver", department: "Delivery", avatar: "AN", color: "pink" },
  { id: "emp-9", name: "Tyler Brooks", role: "Manager", department: "Management", avatar: "TB", color: "indigo" },
  { id: "emp-10", name: "Nina Patel", role: "Hostess", department: "Front of House", avatar: "NP", color: "teal" },
];

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

export const STATIONS = [
  "Pizzaiolo",
  "Cashier",
  "Prep Cook",
  "Delivery",
  "Manager",
] as const;

/** Store hours: 9:00 AM to 12:00 AM (midnight) */
export const STORE_OPEN = "09:00";
export const STORE_CLOSE = "00:00";

/** Grid time axis starts at 9 AM (hour 9) and ends at 12 AM (hour 24) → 15 hours */
export const GRID_START_HOUR = 9;
export const GRID_END_HOUR = 24; // represents midnight (00:00)
export const GRID_TOTAL_HOURS = GRID_END_HOUR - GRID_START_HOUR; // 15

/** Build time options from 9:00 AM to 12:00 AM in 30-minute intervals */
export function getTimeOptions(): string[] {
  const options: string[] = [];
  // 9:00 to 23:30
  for (let h = 9; h < 24; h++) {
    options.push(`${String(h).padStart(2, "0")}:00`);
    options.push(`${String(h).padStart(2, "0")}:30`);
  }
  // Add midnight as end option
  options.push("00:00");
  return options;
}

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

/** Calculate hours between two times (handles midnight wrap) */
export function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60; // wrap past midnight
  return (endMin - startMin) / 60;
}

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
export function timeToPercent(time: string): number {
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

/** Palette of distinguishable colors for overlapping shifts */
export const SHIFT_COLORS = [
  { bg: "bg-blue-500/15 dark:bg-blue-400/20", border: "border-blue-500/40 dark:border-blue-400/40", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-emerald-500/15 dark:bg-emerald-400/20", border: "border-emerald-500/40 dark:border-emerald-400/40", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-violet-500/15 dark:bg-violet-400/20", border: "border-violet-500/40 dark:border-violet-400/40", text: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-amber-500/15 dark:bg-amber-400/20", border: "border-amber-500/40 dark:border-amber-400/40", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-rose-500/15 dark:bg-rose-400/20", border: "border-rose-500/40 dark:border-rose-400/40", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-cyan-500/15 dark:bg-cyan-400/20", border: "border-cyan-500/40 dark:border-cyan-400/40", text: "text-cyan-700 dark:text-cyan-300" },
  { bg: "bg-orange-500/15 dark:bg-orange-400/20", border: "border-orange-500/40 dark:border-orange-400/40", text: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-pink-500/15 dark:bg-pink-400/20", border: "border-pink-500/40 dark:border-pink-400/40", text: "text-pink-700 dark:text-pink-300" },
] as const;

export const DEPARTMENTS = ["All", "Kitchen", "Front of House", "Delivery", "Management"] as const;

export const SHIFT_PRESETS = [
  { label: "Morning", type: "morning" as const, startTime: "08:00", endTime: "16:00" },
  { label: "Evening", type: "evening" as const, startTime: "16:00", endTime: "22:00" },
  { label: "Night", type: "night" as const, startTime: "22:00", endTime: "06:00" },
  { label: "Split AM", type: "split" as const, startTime: "10:00", endTime: "14:00" },
  { label: "Split PM", type: "split" as const, startTime: "17:00", endTime: "21:00" },
] as const;

export const INITIAL_SHIFTS: Shift[] = [
  { id: "shift-1", employeeId: "emp-1", dayIndex: 0, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-2", employeeId: "emp-1", dayIndex: 2, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-3", employeeId: "emp-2", dayIndex: 1, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening" },
  { id: "shift-4", employeeId: "emp-3", dayIndex: 0, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-5", employeeId: "emp-3", dayIndex: 3, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening" },
  { id: "shift-6", employeeId: "emp-4", dayIndex: 1, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-7", employeeId: "emp-4", dayIndex: 4, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-8", employeeId: "emp-5", dayIndex: 0, startTime: "10:00", endTime: "14:00", label: "Split AM", type: "split" },
  { id: "shift-9", employeeId: "emp-5", dayIndex: 0, startTime: "17:00", endTime: "21:00", label: "Split PM", type: "split" },
  { id: "shift-10", employeeId: "emp-6", dayIndex: 2, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening" },
  { id: "shift-11", employeeId: "emp-6", dayIndex: 5, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-12", employeeId: "emp-7", dayIndex: 3, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-13", employeeId: "emp-8", dayIndex: 4, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening" },
  { id: "shift-14", employeeId: "emp-9", dayIndex: 1, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-15", employeeId: "emp-10", dayIndex: 6, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening" },
];

/**
 * Pre-seeded schedule for the previous week (weekOffset = -1).
 * Used as demo data so "Copy Previous Week" works out of the box.
 */
export const PREVIOUS_WEEK_SHIFTS: Shift[] = [
  { id: "pw-1",  employeeId: "emp-1",  dayIndex: 0, startTime: "10:00", endTime: "18:00", label: "Morning",  type: "morning"  },
  { id: "pw-2",  employeeId: "emp-1",  dayIndex: 4, startTime: "10:00", endTime: "18:00", label: "Morning",  type: "morning"  },
  { id: "pw-3",  employeeId: "emp-2",  dayIndex: 0, startTime: "16:00", endTime: "22:00", label: "Evening",  type: "evening"  },
  { id: "pw-4",  employeeId: "emp-2",  dayIndex: 3, startTime: "16:00", endTime: "22:00", label: "Evening",  type: "evening"  },
  { id: "pw-5",  employeeId: "emp-3",  dayIndex: 1, startTime: "08:00", endTime: "16:00", label: "Morning",  type: "morning"  },
  { id: "pw-6",  employeeId: "emp-3",  dayIndex: 5, startTime: "08:00", endTime: "16:00", label: "Morning",  type: "morning"  },
  { id: "pw-7",  employeeId: "emp-4",  dayIndex: 2, startTime: "08:00", endTime: "16:00", label: "Morning",  type: "morning"  },
  { id: "pw-8",  employeeId: "emp-5",  dayIndex: 1, startTime: "10:00", endTime: "14:00", label: "Split AM", type: "split"    },
  { id: "pw-9",  employeeId: "emp-5",  dayIndex: 1, startTime: "17:00", endTime: "21:00", label: "Split PM", type: "split"    },
  { id: "pw-10", employeeId: "emp-6",  dayIndex: 0, startTime: "16:00", endTime: "22:00", label: "Evening",  type: "evening"  },
  { id: "pw-11", employeeId: "emp-7",  dayIndex: 2, startTime: "08:00", endTime: "16:00", label: "Morning",  type: "morning"  },
  { id: "pw-12", employeeId: "emp-8",  dayIndex: 3, startTime: "16:00", endTime: "22:00", label: "Evening",  type: "evening"  },
  { id: "pw-13", employeeId: "emp-9",  dayIndex: 0, startTime: "09:00", endTime: "17:00", label: "Morning",  type: "morning"  },
  { id: "pw-14", employeeId: "emp-10", dayIndex: 5, startTime: "16:00", endTime: "22:00", label: "Evening",  type: "evening"  },
];

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

/** Default overtime threshold in hours */
export const DEFAULT_OVERTIME_THRESHOLD = 40;

/** Mock availability rules — employees blocked on certain days */
export const INITIAL_AVAILABILITY: AvailabilityRule[] = [
  { id: "avail-1", employeeId: "emp-2", dayIndex: 4, allDay: true, reason: "Not available on Saturdays" },
  { id: "avail-2", employeeId: "emp-5", dayIndex: 5, allDay: true, reason: "Unavailable Sundays" },
  { id: "avail-3", employeeId: "emp-7", dayIndex: 6, allDay: false, startTime: "08:00", endTime: "12:00", reason: "Morning classes on Monday" },
  { id: "avail-4", employeeId: "emp-3", dayIndex: 3, allDay: false, startTime: "18:00", endTime: "23:00", reason: "Family commitment Friday evenings" },
];

/** Mock time-off entries — approved PTO / sick / vacation */
export const INITIAL_TIME_OFF: TimeOffEntry[] = [
  { id: "to-1", employeeId: "emp-1", dayIndex: 3, type: "pto", label: "PTO" },
  { id: "to-2", employeeId: "emp-6", dayIndex: 4, type: "vacation", label: "Vacation" },
  { id: "to-3", employeeId: "emp-9", dayIndex: 5, type: "sick", label: "Sick Day" },
];

/**
 * Pre-seeded actual-schedule entries for weekOffset 0, demoing the four review states:
 * confirmed (worked as planned), modified (time changed), absent (no-show), and
 * added (ad-hoc coverage with no planned counterpart).
 */
export const INITIAL_ACTUAL_SHIFTS: ActualShift[] = [
  {
    id: "actual-1",
    employeeId: "emp-1",
    dayIndex: 0,
    startTime: "08:00",
    endTime: "16:00",
    label: "Morning",
    type: "morning",
    status: "confirmed",
    plannedShiftId: "shift-1",
  },
  {
    id: "actual-2",
    employeeId: "emp-4",
    dayIndex: 1,
    startTime: "09:00",
    endTime: "16:00",
    label: "Morning",
    type: "morning",
    status: "modified",
    plannedShiftId: "shift-6",
    note: "Clocked in an hour late",
  },
  {
    id: "actual-3",
    employeeId: "emp-6",
    dayIndex: 5,
    startTime: "08:00",
    endTime: "16:00",
    label: "Morning",
    type: "morning",
    status: "absent",
    plannedShiftId: "shift-11",
    note: "No call, no show",
  },
  {
    id: "actual-4",
    employeeId: "emp-7",
    dayIndex: 5,
    startTime: "08:00",
    endTime: "16:00",
    label: "Morning",
    type: "morning",
    status: "added",
    note: "Covered for Maria Rodriguez",
  },
];
