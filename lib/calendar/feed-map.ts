import { addDays, fromKey, isDayKey, MINUTE } from "./dates";
import type { FeedEvent, FeedSource } from "./feed-types";
import { isScope } from "./toolbox-write";
import { EVENT_STATUSES, type CalendarEvent, type CategoryKey, type EventStatus } from "./types";

/**
 * Feed event (wire shape) → `CalendarEvent` (what the views draw). Pure.
 *
 * The feed's own `type` decides the category. A type that isn't listed here
 * is dropped, as the guide asks ("ignore what you don't know"): new types can
 * appear at any time, and only show once someone maps them. The list includes
 * contract types that aren't built yet (`manager_coverage`, `entry_due`, …), so
 * they light up as soon as a source ships them.
 */
const CATEGORY_BY_TYPE: Readonly<Record<string, CategoryKey>> = {
  // Operations (layer: people)
  shift_day: "shift",
  shift: "shift",
  actual_shift: "shift",
  time_off: "shift",
  manager_coverage: "shift",
  // AuditApp (layers: cleaning, dough)
  cleaning_day_summary: "cleaning",
  cleaning_period_summary: "cleaning",
  cleaning_task: "cleaning",
  cleaning_evaluation: "cleaning",
  dough_plan: "dough",
  dough_judgement: "dough",
  // Data (layers: data, sales, company)
  entry_day_summary: "data",
  entry_due: "data",
  daily_sales: "sales",
  weekly_goal: "meeting",
  // Maintenance
  tech_visit: "maintenance",
  ticket_opened: "maintenance",
  // Inventory
  inventory_count: "inventory",
  // Hiring (layer: hr)
  birthday: "birthday",
  last_working_day: "milestone",
  hiring_need: "milestone",
  // Notifications + Toolbox (layer: company)
  announcement: "meeting",
  calendar_event: "meeting",
  // Toolbox (layers: tasks, mine)
  task: "tasks",
  reminder: "reminders",
};

/** One event per store per day (or period) that rolls up many items. */
const SUMMARY_TYPES = new Set(["shift_day", "cleaning_day_summary", "cleaning_period_summary", "entry_day_summary"]);

const isStatus = (s: unknown): s is EventStatus => (EVENT_STATUSES as readonly unknown[]).includes(s);

/** "deep_clean" → "Deep clean". */
function humanize(value: string): string {
  const s = value.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface FeedMapContext {
  /** store_number → display name (the user's store list). */
  storeNames: ReadonlyMap<string, string>;
  /** Wall clock, for events that are still running. */
  now: number;
}

/**
 * Times in the calendar's convention (local wall-clock `Date`s, all-day `end`
 * = the midnight after the last day — see `types.ts`).
 *
 * All-day: the feed's `date`/`date_end` ARE the days, so they are used as-is,
 * never shifted by a time zone. Timed: `start`/`end` are UTC instants, shown in
 * the viewer's local time. A timed event with no `end` (still on the clock, a
 * visit with only a start) gets a stand-in end and `openEnded`: an hour after
 * the start, or — while it is still running — just past now.
 */
function times(ev: FeedEvent, now: number) {
  if (ev.all_day || !ev.start) {
    if (!isDayKey(ev.date)) return null;
    const first = fromKey(ev.date);
    const last = isDayKey(ev.date_end) ? fromKey(ev.date_end) : first;
    return { start: first, end: addDays(last < first ? first : last, 1), allDay: true, openEnded: false };
  }
  const start = new Date(ev.start);
  if (Number.isNaN(+start)) return null;
  const end = ev.end ? new Date(ev.end) : null;
  if (end && !Number.isNaN(+end) && +end > +start) return { start, end, allDay: false, openEnded: false };
  const running = ev.status === "in_progress";
  const stand = Math.max(+start + 60 * MINUTE, running ? now + 15 * MINUTE : 0);
  return { start, end: new Date(stand), allDay: false, openEnded: !ev.end };
}

export function toCalendarEvent(ev: FeedEvent, origin: FeedSource, ctx: FeedMapContext): CalendarEvent | null {
  const category = CATEGORY_BY_TYPE[ev.type];
  if (!category || typeof ev.id !== "string") return null;
  const t = times(ev, ctx.now);
  if (!t) return null;

  const status = isStatus(ev.status) ? ev.status : undefined;
  const needsAction = status === "overdue" || status === "missed";
  const extra = ev.extra && typeof ev.extra === "object" ? ev.extra : undefined;
  const companyWide = ev.store == null;
  const code = ev.store ?? "";

  // Toolbox events may name their own kind ("inspection") — show that instead
  // of the generic category, like a user event's `typeLabel`.
  const kind = ev.type === "calendar_event" && typeof extra?.category === "string" ? extra.category : null;

  // People that are dashboard users (not employees/technicians), keeping their ids.
  const users = (ev.people ?? []).flatMap((p) =>
    p?.kind === "user" && p.id != null && typeof p.name === "string" ? [{ id: String(p.id), name: p.name }] : [],
  );

  return {
    id: ev.id,
    category,
    title: ev.title || humanize(ev.type),
    start: t.start,
    end: t.end,
    allDay: t.allDay,
    openEnded: t.openEnded || undefined,
    store: { code, name: companyWide ? "" : (ctx.storeNames.get(code) ?? code) },
    companyWide: companyWide || undefined,
    people: (ev.people ?? []).map((p) => p?.name).filter((n): n is string => typeof n === "string" && n.length > 0),
    status,
    // Roll-ups and "already handled" items fill lanes last and add no dots,
    // so the day's dots point at what still needs someone (CALENDAR-EVENT-PRIORITY.md).
    // A summary stops being routine the moment it carries an overdue/missed item.
    routine: ev.type === "daily_sales" || status === "done" || (SUMMARY_TYPES.has(ev.type) && !needsAction) || undefined,
    typeLabel: kind ? humanize(kind) : undefined,
    scope: isScope(extra?.scope) ? extra.scope : undefined,
    users: users.length ? users : undefined,
    source: "system",
    origin,
    feedType: ev.type,
    layer: typeof ev.layer === "string" ? ev.layer : undefined,
    link: typeof ev.link === "string" ? ev.link : undefined,
    counts: ev.counts ?? undefined,
    extra,
  };
}

export function isSummaryEvent(ev: CalendarEvent): boolean {
  return !!ev.feedType && SUMMARY_TYPES.has(ev.feedType);
}
