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
