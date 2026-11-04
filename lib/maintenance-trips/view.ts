/**
 * Trips — what the office drawer and the technician page derive from a
 * presented trip (docs/MAINTENANCE-UI.md §3–4). Pure, React-free.
 */

import { format, parseISO } from "date-fns";
import type {
  IssueStatus,
  TicketAttachment,
  Trip,
  TripAudit,
  TripEventKind,
  TripSession,
  TripState,
  TripStop,
  TripStopIssue,
} from "@/types/maintenance-system";

/* ── Tabs (URL ?tab=) ────────────────────────────────────────────────────── */

export const TRIP_TABS = ["on-clock", "upcoming", "history"] as const;
export type TripTab = (typeof TRIP_TABS)[number];

export function parseTripTab(raw: string | null | undefined): TripTab {
  return (TRIP_TABS as readonly string[]).includes(raw ?? "") ? (raw as TripTab) : "on-clock";
}

/* ── Dates ───────────────────────────────────────────────────────────────── */

/** Today as a local calendar day, `YYYY-MM-DD`. */
export function todayLocal(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

/** An ISO instant → the `YYYY-MM-DDTHH:mm` a DateTimePicker holds (device time). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd'T'HH:mm");
}

/** A DateTimePicker's local `YYYY-MM-DDTHH:mm` → an ISO instant, or null when empty/invalid. */
export function localInputToIso(local: string | null | undefined): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const MS_PER_MINUTE = 60_000;

/** Whole minutes from an ISO instant to now (never negative). */
export function minutesSince(iso: string | null | undefined, now: number = Date.now()): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / MS_PER_MINUTE)) : 0;
}

/* ── State (office side: the server's `state`, else read from the events) ─ */

const SPAN_OF: Record<TripEventKind, { span: "break" | "travel" | "parts_run"; start: boolean }> = {
  break_start: { span: "break", start: true },
  break_end: { span: "break", start: false },
  travel_start: { span: "travel", start: true },
  travel_end: { span: "travel", start: false },
  parts_run_start: { span: "parts_run", start: true },
  parts_run_end: { span: "parts_run", start: false },
};

/** The open session (clocked in, not out, not a mistake), if any. */
export function liveOpenSession(trip: Pick<Trip, "sessions" | "openSessionId">): TripSession | null {
  return (
    trip.sessions.find((s) => s.id === trip.openSessionId && !s.mistaken) ??
    trip.sessions.find((s) => !s.clockOut && !s.mistaken) ??
    null
  );
}

/**
 * What the technician is doing now: the server's `state` (list rows and show
 * carry it, the same reading as his link). Without it (an older server), read
 * from the open session's events the way the server does (break wins over a
 * parts run over driving).
 */
export function officeTripState(trip: Pick<Trip, "sessions" | "openSessionId" | "state">): TripState {
  if (trip.state) return trip.state;
  const open = liveOpenSession(trip);
  if (!open) return "off_clock";
  const running = { break: false, travel: false, parts_run: false };
  [...open.events]
    .filter((e) => !e.mistaken)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .forEach((e) => {
      const spec = SPAN_OF[e.kind];
      if (spec) running[spec.span] = spec.start;
    });
  if (running.break) return "on_break";
  if (running.parts_run) return "parts_run";
  if (running.travel) return "travelling";
  return "on_clock";
}

/* ── Stops ───────────────────────────────────────────────────────────────── */

/** "12" for a store stop, the typed place otherwise. */
export function stopPlace(stop: Pick<TripStop, "store" | "otherStore">): { storeNumber: string | null; other: string | null } {
  return { storeNumber: stop.store?.storeNumber ?? null, other: stop.store ? null : stop.otherStore };
}

/** Stops that count (not removed as a mistake). */
export function liveStops(trip: Pick<Trip, "stops">): TripStop[] {
  return trip.stops.filter((s) => !s.mistaken);
}

/** Where he is now (arrived, not left), else the next planned stop. */
export function currentStop(trip: Pick<Trip, "stops">): TripStop | null {
  const stops = liveStops(trip);
  return stops.find((s) => s.status === "arrived" && !s.leftAt) ?? stops.find((s) => s.status === "planned") ?? null;
}

/** Jobs at a stop still to do. */
export function pendingIssues(stop: Pick<TripStop, "issues">): TripStopIssue[] {
  return stop.issues.filter((i) => i.taskStatus === "pending");
}

/** "3 of 5 jobs done" numbers over the trip. */
export function jobCounts(trip: Pick<Trip, "stops">): { done: number; total: number } {
  const issues = liveStops(trip).flatMap((s) => s.issues);
  return { done: issues.filter((i) => i.taskStatus === "done").length, total: issues.length };
}

/* ── Files ───────────────────────────────────────────────────────────────── */

/** Every file on the trip: the trip's own, each visit's, each session's (odometer photos). */
export function tripFiles(trip: Pick<Trip, "attachments" | "stops" | "sessions">): TicketAttachment[] {
  const seen = new Set<number>();
  return [
    ...(trip.attachments ?? []),
    ...trip.stops.flatMap((s) => s.attachments ?? []),
    ...trip.sessions.flatMap((s) => s.attachments ?? []),
  ].filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}

/* ── Audits ──────────────────────────────────────────────────────────────── */

export interface AuditChange {
  field: string;
  before: string;
  after: string;
}

function show(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** The fields an audit changed, before → after (unchanged ones left out). */
export function auditChanges(audit: Pick<TripAudit, "before" | "after">): AuditChange[] {
  const before = audit.before ?? {};
  const after = audit.after ?? {};
  const fields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return fields
    .map((field) => ({ field, before: show(before[field]), after: show(after[field]) }))
    .filter((c) => c.before !== c.after);
}

/* ── New trip: which issues can go on a trip ────────────────────────────── */

/** Issue statuses a technician can still be sent for (not closed / cancelled). */
export const TRIPPABLE_ISSUE_STATUSES: readonly IssueStatus[] = [
  "new",
  "in_review",
  "waiting_on_store",
  "inspection",
  "waiting_approval",
  "scheduled",
  "work_done",
];

export function isTrippable(status: string | null | undefined): boolean {
  return (TRIPPABLE_ISSUE_STATUSES as readonly string[]).includes(status ?? "");
}
