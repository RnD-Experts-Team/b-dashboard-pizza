export interface ScheduleEmployee {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
  color: string; // tailwind color tag like "blue", "emerald", "violet", etc.
}

export interface Shift {
  id: string;
  employeeId: string;
  dayIndex: number; // 0=Tue, 1=Wed, 2=Thu, 3=Fri, 4=Sat, 5=Sun, 6=Mon
  startTime: string; // "HH:mm" 24h
  endTime: string;   // "HH:mm" 24h
  label: string;     // e.g. "Morning", "Evening", "Night"
  type: "morning" | "evening" | "night" | "split" | "custom";
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
  createdAt: string; // ISO string
  shifts: Omit<Shift, "id">[];
  shiftCount: number;
  totalHours: number;
}
