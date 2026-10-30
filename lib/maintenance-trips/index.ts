/**
 * Trips pure logic: session durations, the trip link and its share text,
 * and the technician page's state → big buttons mapping
 * (docs/MAINTENANCE-V2-UI.md §3–4).
 */

import { formatMinutes } from "@/lib/maintenance/money";
import { TRIP_STATES, type VocabEntry } from "@/lib/maintenance/vocabulary";
import type { SessionDurations, Trip, TripEventKind, TripSession, TripState } from "@/types/maintenance-v2";

export { formatMinutes };

/* ── Durations ───────────────────────────────────────────────────────────── */

/** "Paid 3h 25m · Breaks 30m" pieces for one session. */
export function sessionDurationParts(d: SessionDurations): { key: keyof SessionDurations; minutes: number; text: string }[] {
  const order: (keyof SessionDurations)[] = ["paid", "work", "travel", "partsRun", "break"];
  return order.map((key) => ({ key, minutes: d[key], text: formatMinutes(d[key]) }));
}

/** Totals over the sessions that count (mistaken ones never do). */
export function sumDurations(sessions: readonly TripSession[]): SessionDurations {
  return sessions
    .filter((s) => !s.mistaken)
    .reduce<SessionDurations>(
      (acc, s) => ({
        work: acc.work + s.durations.work,
        travel: acc.travel + s.durations.travel,
        partsRun: acc.partsRun + s.durations.partsRun,
        break: acc.break + s.durations.break,
        paid: acc.paid + s.durations.paid,
      }),
      { work: 0, travel: 0, partsRun: 0, break: 0, paid: 0 },
    );
}

/** The open session (clocked in, not out), if any. */
export function openSession(trip: Pick<Trip, "sessions" | "openSessionId">): TripSession | null {
  return trip.sessions.find((s) => s.id === trip.openSessionId) ?? trip.sessions.find((s) => !s.clockOut && !s.mistaken) ?? null;
}

/* ── The link ────────────────────────────────────────────────────────────── */

/**
 * The technician's link: `${origin}/${locale}/trip/${token}`. The plain token
 * is only ever returned once (when issued), so build this right then.
 */
export function tripLinkUrl(token: string, locale: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/${encodeURIComponent(locale)}/trip/${encodeURIComponent(token)}`;
}

const WEEKDAY: Intl.DateTimeFormatOptions = { weekday: "short" };

/** "Tue" for a YYYY-MM-DD (read as a local calendar day, not UTC). */
export function shortWeekday(date: string, locale = "en-US"): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString(locale, WEEKDAY);
}

/**
 * The message sent with Share (WhatsApp/SMS via the Web Share API):
 * "Your trip for Store 12 on Tue: <link>". `template` is the translated
 * `maintenanceV2.trips.shareText` with {stores} {day} {link} placeholders.
 */
export function tripShareText(opts: {
  link: string;
  plannedDate: string;
  storeNumbers: readonly string[];
  locale?: string;
  template?: string;
}): string {
  const stores = opts.storeNumbers.length ? opts.storeNumbers.map((n) => `Store ${n}`).join(", ") : "your stores";
  const day = shortWeekday(opts.plannedDate, opts.locale);
  const template = opts.template ?? "Your trip for {stores} on {day}: {link}";
  return template.replace("{stores}", stores).replace("{day}", day).replace("{link}", opts.link);
}

/** Store numbers of a trip's stops, for the share text. */
export function tripStoreNumbers(trip: Pick<Trip, "stops">): string[] {
  return trip.stops.flatMap((s) => (s.store ? [s.store.storeNumber] : []));
}

/* ── The technician page's buttons ───────────────────────────────────────── */

export type TripButtonId =
  | "clock_in"
  | "clock_out"
  | "break_start"
  | "break_end"
  | "travel_start"
  | "travel_end"
  | "parts_run_start"
  | "parts_run_end";

export interface TripButton {
  id: TripButtonId;
  key: string;
  label: string;
  /** lucide-react icon name. */
  icon: string;
  /** The event to post; null for clock in/out (their own endpoints). */
  event: TripEventKind | null;
}

const button = (id: TripButtonId, label: string, icon: string, event: TripEventKind | null): TripButton => ({
  id,
  key: `tripPortal.buttons.${id}`,
  label,
  icon,
  event,
});

export const TRIP_BUTTONS = {
  clock_in: button("clock_in", "Clock in", "LogIn", null),
  clock_out: button("clock_out", "Clock out", "LogOut", null),
  break_start: button("break_start", "Start break", "Coffee", "break_start"),
  break_end: button("break_end", "End break", "Coffee", "break_end"),
  travel_start: button("travel_start", "Driving", "Car", "travel_start"),
  travel_end: button("travel_end", "Stop driving", "Car", "travel_end"),
  parts_run_start: button("parts_run_start", "Getting parts", "ShoppingBag", "parts_run_start"),
  parts_run_end: button("parts_run_end", "Back from parts", "ShoppingBag", "parts_run_end"),
} as const satisfies Record<TripButtonId, TripButton>;

export interface TripStateButtons {
  /** The big state pill. */
  state: VocabEntry<TripState>;
  /** The one giant primary button. */
  primary: TripButton;
  /** The big secondary buttons under it. */
  secondary: TripButton[];
}

/**
 * State → buttons. Off the clock: only Clock in. On the clock: Clock out, and
 * start a break / driving / a parts run. In one of those: end it, or clock
 * out (which closes it first, upstream).
 */
export const BUTTONS_BY_STATE = {
  off_clock: { primary: TRIP_BUTTONS.clock_in, secondary: [] },
  on_clock: {
    primary: TRIP_BUTTONS.clock_out,
    secondary: [TRIP_BUTTONS.break_start, TRIP_BUTTONS.travel_start, TRIP_BUTTONS.parts_run_start],
  },
  on_break: { primary: TRIP_BUTTONS.break_end, secondary: [TRIP_BUTTONS.clock_out] },
  travelling: { primary: TRIP_BUTTONS.travel_end, secondary: [TRIP_BUTTONS.clock_out] },
  parts_run: { primary: TRIP_BUTTONS.parts_run_end, secondary: [TRIP_BUTTONS.clock_out] },
} as const satisfies Record<TripState, { primary: TripButton; secondary: readonly TripButton[] }>;

export function buttonsForState(state: TripState): TripStateButtons {
  const { primary, secondary } = BUTTONS_BY_STATE[state];
  return { state: TRIP_STATES[state], primary, secondary: [...secondary] };
}

/** Paired light/dark tone for the state pill (always with its text). */
export const TRIP_STATE_TONE = {
  off_clock: "bg-muted text-muted-foreground",
  on_clock: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  on_break: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  travelling: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  parts_run: "bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
} as const satisfies Record<TripState, string>;

/* ── Views (tabs, dates, office state, stops, files, audits) ─────────────── */

export * from "./view";
