export interface ScheduleEmployee {
  id: string;
  name: string;
  age: number;
  avatar: string;
  station: string;
  totalHours: number;
}

export interface Shift {
  id: string;
  employeeId: string;
  dayIndex: number; // 0=Mon, 1=Tue, ...6=Sun
  startTime: string; // "HH:mm" 24h format
  endTime: string; // "HH:mm" 24h format
  station: string;
}  

export interface PublishedSchedule {
  id: string;
  weekLabel: string;
  publishedAt: string;
  screenshotDataUrl: string;
  shifts: Shift[];
}
