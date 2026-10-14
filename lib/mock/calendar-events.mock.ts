/**
 * Calendar mock data — the ONLY data source for the Calendar until a real
 * `/api/calendar/events` route exists. `lib/api/services/calendar.service.ts`
 * is the single caller; swap it there and nothing in the UI has to change.
 *
 * Seeded per (year, primary store) so reloads show the same calendar, and
 * built RELATIVE TO TODAY so there is always something happening now:
 * a birthday + a work anniversary today, a live maintenance visit, a
 * multi-day training that started yesterday, overlapping shifts, etc.
 *
 * Event titles, notes and names are DATA (they'd come from the API), not UI
 * strings — birthdays/anniversaries use `titleKey` so their titles translate.
 */
import { MINUTE, addDays, startOfDay } from "@/lib/calendar/dates";
import { compareEvents } from "@/lib/calendar/layout";
import type { CalendarEvent, CalendarStoreRef, DateRange } from "@/lib/calendar/types";

/** Stand-in neighbours for the selected store (codes from lib/mock/wbr-reports.mock.ts). */
const OTHER_STORES: CalendarStoreRef[] = [
  { code: "03795-00001", name: "Downtown" },
  { code: "03795-00002", name: "Riverside" },
  { code: "03795-00003", name: "Northgate" },
  { code: "03795-00004", name: "Oak Park" },
  { code: "03795-00005", name: "Lakeview" },
];

/** [name, role, storeIndex, birth [month0, day], birth year, hired [y, month0, day]] */
type EmployeeRow = [string, string, number, [number, number], number, [number, number, number]];
const EMPLOYEE_ROWS: EmployeeRow[] = [
  ["Maria Lopez", "Store Manager", 0, [0, 1], 1991, [2019, 2, 14]],
  ["James Carter", "Shift Lead", 0, [3, 22], 1996, [2020, 0, 6]],
  ["Aisha Khan", "Cook", 0, [6, 9], 2001, [2022, 5, 1]],
  ["Daniel Kim", "Driver", 1, [1, 17], 1999, [2021, 8, 12]],
  ["Sofia Rossi", "CSR", 1, [10, 3], 2003, [2023, 1, 20]],
  ["Omar Haddad", "Shift Lead", 1, [7, 28], 1994, [2020, 3, 6]],
  ["Emily Chen", "General Manager", 2, [4, 14], 1988, [2018, 9, 2]],
  ["Marcus Johnson", "Cook", 2, [8, 30], 1998, [2022, 10, 15]],
  ["Priya Patel", "CSR", 2, [11, 11], 2002, [2024, 0, 8]],
  ["Lucas Martin", "Driver", 3, [2, 5], 2000, [2023, 6, 19]],
  ["Nora Ali", "Shift Lead", 3, [5, 21], 1997, [2021, 2, 27]],
  ["Ethan Brooks", "Cook", 3, [9, 26], 1995, [2020, 11, 1]],
  ["Grace Nguyen", "CSR", 4, [0, 19], 2004, [2024, 4, 13]],
  ["Diego Ramirez", "Driver", 4, [3, 2], 1993, [2019, 7, 23]],
  ["Hannah Weber", "Store Manager", 4, [8, 8], 1990, [2017, 4, 4]],
  ["Samuel Okafor", "Cook", 0, [5, 1], 1999, [2022, 1, 9]],
  ["Lina Saeed", "CSR", 1, [11, 29], 2001, [2023, 9, 30]],
  ["Tyler Reed", "Driver", 2, [7, 7], 1998, [2021, 4, 17]],
];

const MAINTENANCE = [
  { title: "Oven #2 service visit", h: 9, m: 0, dur: 120, notes: "Technician checks conveyor belt tension and burner flame." },
  { title: "HVAC filter replacement", h: 7, m: 0, dur: 60, notes: "Roof access needed. Keep the back door clear." },
  { title: "Walk-in cooler inspection", h: 11, m: 0, dur: 45, notes: "Temperature log for the last 14 days must be on hand." },
  { title: "POS terminal repair", h: 13, m: 30, dur: 90, notes: "Register 2 drops card payments intermittently." },
  { title: "Drive-thru headset check", h: 15, m: 0, dur: 30, notes: "Swap batteries and test both channels." },
  { title: "Pest control visit", h: 6, m: 30, dur: 60, notes: "Routine quarterly treatment before opening." },
];

/** Shift presets from lib/scheduling/constants.ts. */
const SHIFT_PRESETS = [
  { h: 8, m: 0, dur: 480 },
  { h: 16, m: 0, dur: 360 },
  { h: 10, m: 0, dur: 240 },
  { h: 17, m: 0, dur: 240 },
];
const OPEN_SHIFTS = ["Open driver shift", "Open cook shift", "Open CSR shift"];

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/** A fixed (month, day) in year y, folding Feb 29 to Feb 28 on non-leap years. */
function yearDate(y: number, md: [number, number]): Date {
  const d = new Date(y, md[0], md[1]);
  return d.getMonth() === md[0] ? d : new Date(y, md[0], md[1] - 1);
}

/** The selected store leads the list; neighbours fill the rest (no duplicate code). */
function storesFor(primary: CalendarStoreRef | null): CalendarStoreRef[] {
  if (!primary) return OTHER_STORES;
  return [primary, ...OTHER_STORES.filter((s) => s.code !== primary.code)].slice(0, 5);
}

const cache = new Map<string, CalendarEvent[]>();

function buildYear(y: number, primary: CalendarStoreRef | null): CalendarEvent[] {
  const STORES = storesFor(primary);
  const r = rng(y * 7919 + 17 + hash(primary?.code ?? ""));
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
  const now = new Date();

  const employees = EMPLOYEE_ROWS.map(([name, role, si, birth, born, hired]) => ({
    name,
    first: name.split(" ")[0],
    role,
    store: STORES[si % STORES.length],
    birth,
    born,
    hired,
  }));
  // Guarantee "today" content: a birthday and a work anniversary fall today.
  employees[0].birth = [now.getMonth(), now.getDate()];
  employees[1].hired = [now.getFullYear() - 4, now.getMonth(), now.getDate()];
  const leads = employees.filter((e) => e.role === "Shift Lead");

  const events: CalendarEvent[] = [];
  let n = 0;
  const add = (e: Omit<CalendarEvent, "id" | "people" | "allDay" | "store"> & Partial<CalendarEvent>) => {
    events.push({ id: `${y}-${++n}`, people: [], allDay: false, store: STORES[0], ...e });
  };
  const timed = (day: Date, h: number, m: number, dur: number) => {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
    return { start, end: new Date(+start + dur * MINUTE) };
  };
  const allDay = (day: Date) => ({ start: day, end: addDays(day, 1), allDay: true });
  const multi = (start: Date, days: number) => ({ start, end: addDays(start, days), allDay: true });

  // People: birthdays + hire anniversaries (yearly).
  for (const emp of employees) {
    add({
      ...allDay(yearDate(y, emp.birth)),
      category: "birthday",
      titleKey: "birthday",
      titleVars: { name: emp.first },
      store: emp.store,
      people: [emp.name],
      meta: { age: y - emp.born, role: emp.role },
    });
    if (y > emp.hired[0]) {
      add({
        ...allDay(yearDate(y, [emp.hired[1], emp.hired[2]])),
        category: "milestone",
        titleKey: "anniversary",
        titleVars: { name: emp.first },
        store: emp.store,
        people: [emp.name],
        meta: { years: y - emp.hired[0], role: emp.role },
      });
    }
  }

  // Day-by-day recurring + random events.
  for (let day = new Date(y, 0, 1); day.getFullYear() === y; day = addDays(day, 1)) {
    const dow = day.getDay();
    const dom = day.getDate();

    add({
      ...timed(day, 22, 30, 30),
      category: "cleaning",
      title: "Sanitize make line",
      routine: true,
      people: [pick(leads).name],
      notes: "Food-safe sanitizer at 200 ppm. Photo required before close.",
    });
    if (dow === 1)
      add({ ...timed(day, 14, 0, 60), category: "cleaning", title: "Deep clean oven hood", people: [pick(employees).name], notes: "Degrease filters and wipe the hood interior." });
    if (dow === 4)
      add({ ...timed(day, 15, 0, 45), category: "cleaning", title: "Mop walk-in cooler", store: STORES[1], people: [pick(employees).name] });
    if (dom === 1)
      add({ ...timed(day, 9, 0, 60), category: "cleaning", title: "Descale dish machine", notes: "Monthly task. Log the chemical batch number." });
    if (dom === 15)
      add({ ...timed(day, 8, 30, 60), category: "cleaning", title: "Clean ice machine", store: STORES[2] });

    if (dow === 1)
      add({ ...timed(day, 17, 0, 30), category: "shift", title: "Next week's schedule published", notes: "Payroll week starts Tuesday. Review open shifts before it locks." });
    if (r() < 0.38) {
      const p = pick(SHIFT_PRESETS);
      add({ ...timed(day, p.h, p.m, p.dur), category: "shift", title: pick(OPEN_SHIFTS), store: pick(STORES), notes: "Unclaimed. Visible to everyone eligible at this store." });
    }
    if (r() < 0.1) {
      const a = pick(employees);
      const b = pick(employees);
      if (a !== b)
        add({ ...timed(day, 16, 0, 360), category: "shift", title: "Shift swap", store: a.store, people: [a.name, b.name], notes: "Approved by the store manager." });
    }

    if (dow === 3)
      add({ ...timed(day, 10, 0, 30), category: "meeting", title: "Managers' huddle", people: ["Maria Lopez", "James Carter", "Omar Haddad"], notes: "Weekly sales, labor % and open tickets." });
    if (dow === 4 && dom >= 8 && dom <= 14)
      add({ ...timed(day, 13, 0, 90), category: "meeting", title: "District review", store: STORES[2], people: ["Emily Chen", "Maria Lopez", "Hannah Weber"] });
    if (r() < 0.04)
      add({ ...timed(day, 15, 0, 60), category: "meeting", title: "Food safety training", store: pick(STORES), notes: "Mandatory for new hires within 30 days." });

    if (r() < 0.07) {
      const mt = pick(MAINTENANCE);
      add({ ...timed(day, mt.h, mt.m, mt.dur), category: "maintenance", title: mt.title, store: pick(STORES), notes: mt.notes });
    }
  }

  // Multi-day (all-day) events: drawn as continuous bars.
  for (const m of [1, 4, 7, 10])
    add({ ...multi(new Date(y, m, 10), 3), category: "maintenance", title: "Oven line service", store: STORES[1], notes: "Make line 2 offline. Expect slower ticket times at this store." });
  for (const m of [2, 5, 8, 11])
    add({ ...multi(new Date(y, m, 18), 2), category: "meeting", title: "Regional managers' summit", store: STORES[2], people: ["Emily Chen", "Maria Lopez", "Hannah Weber"] });

  // Guaranteed content around today (exercises overlaps and multi-day bars).
  if (y === now.getFullYear()) {
    const today = startOfDay(now);
    add({ ...multi(addDays(today, -1), 3), category: "meeting", title: "Fall menu rollout training", people: ["Maria Lopez", "James Carter", "Aisha Khan", "Sofia Rossi"], notes: "New menu items, prep standards and upsell scripts." });
    add({ ...multi(addDays(today, -9), 5), category: "cleaning", title: "Deep clean week", people: ["James Carter"], notes: "One zone per day: ovens, make line, walk-in, dish area, lobby." });
    add({ ...multi(addDays(today, 12), 3), category: "maintenance", title: "Walk-in cooler replacement", notes: "Move stock to the reach-ins the night before." });
    add({ ...timed(today, 9, 0, 120), category: "maintenance", title: MAINTENANCE[0].title, notes: MAINTENANCE[0].notes });
    if (today.getDay() !== 3)
      add({ ...timed(today, 10, 0, 30), category: "meeting", title: "Managers' huddle", people: ["Maria Lopez", "James Carter", "Omar Haddad"], notes: "Weekly sales, labor % and open tickets." });
    if (today.getDay() !== 1)
      add({ ...timed(today, 14, 0, 60), category: "cleaning", title: "Deep clean oven hood", people: ["Aisha Khan"], notes: "Degrease filters and wipe the hood interior." });
    add({ ...timed(today, 16, 0, 360), category: "shift", title: "Open driver shift", notes: "Unclaimed. Visible to everyone eligible at this store." });
  }

  // Cleaning status, relative to the real clock.
  const nowMs = Date.now();
  for (const e of events) {
    if (e.category !== "cleaning") continue;
    e.status = +e.end < nowMs ? (r() < 0.86 ? "done" : "overdue") : "pending";
  }

  return events.sort(compareEvents);
}

function yearEvents(y: number, primary: CalendarStoreRef | null): CalendarEvent[] {
  const key = `${y}|${primary?.code ?? ""}`;
  let list = cache.get(key);
  if (!list) {
    list = buildYear(y, primary);
    cache.set(key, list);
  }
  return list;
}

/** Events overlapping [from, to) for a primary store. Synchronous; the service wraps it. */
export function getMockCalendarEvents(
  range: DateRange,
  primary: CalendarStoreRef | null,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  // Start a year early: multi-day events can begin in December and run into January.
  const lastYear = new Date(+range.to - 1).getFullYear();
  for (let y = range.from.getFullYear() - 1; y <= lastYear; y++) {
    for (const e of yearEvents(y, primary)) {
      if (e.start < range.to && e.end > range.from) out.push(e);
    }
  }
  return out.sort(compareEvents);
}
