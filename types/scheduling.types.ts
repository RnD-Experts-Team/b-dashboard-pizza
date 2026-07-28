export interface ScheduleEmployee {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
  color: string;
}

export interface Shift {
  id: string;
  employeeId: string;
  dayIndex: number; // 0=Tue, 1=Wed, 2=Thu, 3=Fri, 4=Sat, 5=Sun, 6=Mon
  startTime: string; // "HH:mm" 24h
  endTime: string;   // "HH:mm" 24h
  label: string;
  type: "morning" | "evening" | "night" | "split" | "custom";
  isRecurring?: boolean;
  recurringGroupId?: string;
  note?: string;
}

export type ActualShiftStatus = "confirmed" | "modified" | "absent" | "added";

export interface ActualShift {
  id: string;
  employeeId: string;
  dayIndex: number;
  startTime: string;
  endTime: string;
  label: string;
  type: Shift["type"];
  /** confirmed = matches the planned shift as-is; modified = time/label changed;
   *  absent = no attendance; added = ad-hoc coverage with no planned counterpart */
  status: ActualShiftStatus;
  /** Links back to the originating planned Shift. Absent for "added" entries. */
  plannedShiftId?: string;
  note?: string;
}

export type ScheduleMode = "planned" | "actual";

export interface AvailabilityRule {
  id: string;
  employeeId: string;
  dayIndex: number;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  reason: string;
}

export interface TimeOffEntry {
  id: string;
  employeeId: string;
  dayIndex: number;
  type: "pto" | "vacation" | "sick";
  label: string;
}

export interface ShiftConflict {
  shiftA: Shift;
  shiftB: Shift;
  employeeId: string;
  dayIndex: number;
}

export interface PublishedSchedule {
  id: string;
  weekLabel: string;
  publishedAt: string;
  screenshotDataUrl: string;
  shifts: Shift[];
}

export interface WeekInfo {
  start: Date;
  end: Date;
  label: string;
  dayDates: string[];
  fullDates: Date[];
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  shifts: Omit<Shift, "id">[];
  shiftCount: number;
  totalHours: number;
}

export type ScheduleViewMode = "week" | "day" | "month";
