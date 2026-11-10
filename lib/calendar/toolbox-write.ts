import type { CalendarEvent } from "./types";

/**
 * What the Calendar writes to Toolbox (FRONTEND_CALENDAR_GUIDE §8): events,
 * tasks and reminders. Pure functions — no React, no network.
 */

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

/**
 * Who an event or task is for (guide §8.1):
 * - `custom`: the chosen stores (anyone can create);
 * - `public`: every store open now (super admin only);
 * - `private`: only its creator, no store (super admin only).
 */
export const SCOPES = ["custom", "public", "private"] as const;
export type Scope = (typeof SCOPES)[number];

export const isScope = (value: unknown): value is Scope => (SCOPES as readonly unknown[]).includes(value);

/**
 * Store tasks move start → submit → approve/return (§8.3). A private task is
 * only done or not done (`done` / `reopen`, §8.3.1).
 */
export type TaskAction = "start" | "submit" | "approve" | "return" | "done" | "reopen";
export type ReminderAction = "snooze" | "done" | "cancel";

/** What a reminder points at: the event it was made from (any project). */
export interface ReminderTarget {
  ref: string;
  title: string;
  /** A dashboard path (`/dashboard/...`, no locale): where the bell takes you. */
  link?: string | null;
}

interface Shared {
  title: string;
  /** Default `custom`. Public and private take no stores. */
  scope: Scope;
  /** Store numbers (`03795-00001`), 1 to 50 — `custom` only. */
  stores: string[];
  /** "YYYY-MM-DD". */
  date: string;
  description?: string;
  /** Free text ("inspection"); shown as the event's own type name. */
  category?: string;
  priority: Priority;
}

export interface CreateEventInput extends Shared {
  type: "event";
  /** "HH:mm", both optional; no times = all day. */
  startTime?: string;
  endTime?: string;
}

export interface CreateTaskInput extends Shared {
  type: "task";
  /** The deadline ("HH:mm"); without it the task is due at the end of the day. */
  startTime?: string;
  /** "note" asks the store for a note when it submits. */
  proof: "none" | "note";
  /** False = approved as soon as it is submitted. */
  requiresReview: boolean;
}

export interface CreateReminderInput {
  type: "reminder";
  title: string;
  /** Minutes from now (1 to 525600), or an exact future moment. Exactly one. */
  when: { inMinutes: number } | { at: Date };
  target?: ReminderTarget;
}

export type CreateItemInput = CreateEventInput | CreateTaskInput | CreateReminderInput;

const put = (key: string, value: unknown) => (value === undefined || value === "" ? {} : { [key]: value });

/** The `POST /calendar/events` body. Empty optional fields are left out, never sent as "". */
export function toCreatePayload(input: CreateItemInput): Record<string, unknown> {
  if (input.type === "reminder") {
    const when = "inMinutes" in input.when ? { in_minutes: input.when.inMinutes } : { remind_at: input.when.at.toISOString() };
    return {
      type: "reminder",
      title: input.title,
      reminder: {
        ...when,
        ...put("target_ref", input.target?.ref),
        ...put("target_title", input.target?.title),
        ...put("target_link", input.target?.link ?? undefined),
      },
    };
  }
  const base = {
    type: input.type,
    title: input.title,
    scope: input.scope,
    // Stores only with `custom`: sent with public or private they are a 422.
    ...(input.scope === "custom" ? { stores: input.stores } : {}),
    date: input.date,
    priority: input.priority,
    ...put("description", input.description?.trim()),
    ...put("category", input.category?.trim()),
    ...put("start_time", input.startTime),
  };
  if (input.type === "event") return { ...base, ...put("end_time", input.endTime) };
  // A private task has no proof and no review (the server ignores them).
  if (input.scope === "private") return { ...base, task: {} };
  return { ...base, task: { proof: input.proof, requires_review: input.requiresReview } };
}

/** Toolbox's own number for an event: the third part of its id (`toolbox:task:42:03795-00001` → 42). */
export function toolboxIdOf(ev: CalendarEvent): number | null {
  if (ev.origin !== "toolbox") return null;
  const n = Number(ev.id.split(":")[2]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** A private event or task: only its creator sees it (`extra.scope`, `store` null, `layer` "mine"). */
export const isPrivate = (ev: CalendarEvent): boolean => ev.scope === "private";

/** A private task's two actions go without a store (`tasks/{id}/done|reopen`). */
export const isPrivateTaskAction = (action: TaskAction): boolean => action === "done" || action === "reopen";

const taskStatusOf = (ev: CalendarEvent): string | null =>
  typeof ev.extra?.task_status === "string" ? ev.extra.task_status : null;

/** Who is looking: the signed-in user (`useAuthStore().user`). */
export interface Viewer {
  id: string | number;
  name: string;
}

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** The same person: same id, or (ids can come from different tables) the same full name. */
const isViewer = (p: { id: string; name: string }, viewer: Viewer): boolean =>
  p.id === String(viewer.id) || (!!norm(p.name) && norm(p.name) === norm(viewer.name));

/**
 * Whether the viewer may be the creator of this item. Toolbox lets only the creator
 * cancel an event/task and approve or return a task (guide §8.2–8.3; anyone else gets
 * a 403) but the feed has no "can do" flag, so it is read from who the item names:
 * - a private item is only ever visible to its creator → yes;
 * - otherwise the `user` people on it are its creator (the create body names no
 *   other people) → yes only if the viewer is one of them;
 * - nobody named, or no signed-in user → unknown, so yes: show it, Toolbox decides.
 */
export function mayBeCreator(ev: CalendarEvent, viewer: Viewer | null): boolean {
  if (isPrivate(ev)) return true;
  if (!ev.users?.length || !viewer) return true;
  return ev.users.some((u) => isViewer(u, viewer));
}

/**
 * What the viewer can do next with a task (the lifecycle in guide §8.3). Start and
 * submit are the store's; approve and return are the creator's, so they are offered
 * on a submitted task only to someone who may be its creator.
 */
export function taskActionsFor(ev: CalendarEvent, viewer: Viewer | null = null): TaskAction[] {
  if (ev.feedType !== "task" || toolboxIdOf(ev) == null) return [];
  if (isPrivate(ev)) {
    if (ev.status === "cancelled") return [];
    return ev.status === "done" ? ["reopen"] : ["done"];
  }
  switch (taskStatusOf(ev)) {
    case "open":
    case "returned":
      return ["start", "submit"];
    case "in_progress":
      return ["submit"];
    case "submitted":
      return mayBeCreator(ev, viewer) ? ["approve", "return"] : [];
    default:
      return [];
  }
}

/** A task waiting for its creator's review. */
export function awaitingReview(ev: CalendarEvent): boolean {
  return ev.feedType === "task" && (ev.extra?.awaiting_review === true || taskStatusOf(ev) === "submitted");
}

/** Where a store task stands, as a sign on the task itself (the card's buttons say what to do next). */
export type TaskSign = "started" | "submitted" | "returned" | "approved";

/** The task's sign, or null while it is just waiting (or when it is not a task). A private task has none. */
export function taskSign(ev: CalendarEvent): TaskSign | null {
  if (ev.feedType !== "task" || isPrivate(ev)) return null;
  switch (taskStatusOf(ev)) {
    case "in_progress":
      return "started";
    case "submitted":
      return "submitted";
    case "returned":
      return "returned";
    case "approved":
      return "approved";
    default:
      return awaitingReview(ev) ? "submitted" : null;
  }
}

/**
 * My reminders by the event they were made from (a reminder's `extra.target_ref`),
 * so an event can say "you set a reminder for this" wherever it is drawn.
 */
export function reminderTargets(events: readonly CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const target = e.feedType === "reminder" ? e.extra?.target_ref : null;
    if (typeof target !== "string") continue;
    const list = map.get(target);
    if (list) list.push(e);
    else map.set(target, [e]);
  }
  return map;
}

/** A reminder from `GET /calendar/reminders`, boiled down to what the Calendar needs. */
export interface ReminderRef {
  id: number | string;
  /** The event it was made from (`target_ref` = that event's id). */
  targetRef: string;
  /** When it rings. */
  at: Date;
  status: string | null;
}

/**
 * Reads the reminders list. The guide doesn't spell out a row, so this is lenient:
 * a row is the reminder resource, with its fields under `reminder` or flat; a row
 * that isn't about an event (no `target_ref`) or has no id is skipped, and so is
 * one that is already done or cancelled — those are no longer "a reminder set".
 */
export function parseReminderList(body: unknown): ReminderRef[] {
  const wrapped = body && typeof body === "object" ? (body as { data?: unknown }).data : undefined;
  const rows: unknown[] = Array.isArray(wrapped) ? wrapped : Array.isArray(body) ? body : [];
  const out: ReminderRef[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const inner = row.reminder && typeof row.reminder === "object" ? (row.reminder as Record<string, unknown>) : row;
    const pick = (key: string) => inner[key] ?? row[key];
    const targetRef = pick("target_ref");
    if (typeof targetRef !== "string" || !targetRef) continue;
    if (typeof row.id !== "number" && typeof row.id !== "string") continue;
    const status = [pick("status"), pick("reminder_status")].find((v): v is string => typeof v === "string") ?? null;
    if (status === "done" || status === "cancelled" || status === "canceled") continue;
    const at = new Date(String(pick("remind_at") ?? ""));
    out.push({ id: row.id, targetRef, at: Number.isNaN(+at) ? new Date() : at, status });
  }
  return out;
}

/** A listed reminder as a reminder event, so cards and signs treat it like one that came in the feed. */
export function reminderEventOf(ref: ReminderRef): CalendarEvent {
  return {
    id: `toolbox:reminder:${ref.id}`,
    category: "reminders",
    start: ref.at,
    end: ref.at,
    allDay: false,
    store: { code: "", name: "" },
    companyWide: true,
    people: [],
    status: "scheduled",
    source: "system",
    origin: "toolbox",
    feedType: "reminder",
    layer: "mine",
    extra: { target_ref: ref.targetRef, reminder_status: ref.status },
  };
}

/**
 * My reminders by event, from the feed AND from Toolbox's own list. The feed only
 * has the reminders that ring inside the visible range, so an event whose reminder
 * rings next month would show nothing; the list covers every day. The same
 * reminder (same Toolbox id) is counted once, the feed's copy first.
 */
export function mergeReminderTargets(
  feed: Map<string, CalendarEvent[]>,
  listed: readonly ReminderRef[],
): Map<string, CalendarEvent[]> {
  const out = new Map<string, CalendarEvent[]>([...feed].map(([k, v]) => [k, [...v]]));
  const seen = new Set<number>();
  for (const list of feed.values()) for (const e of list) if (toolboxIdOf(e) != null) seen.add(toolboxIdOf(e)!);
  for (const ref of listed) {
    const id = Number(ref.id);
    if (Number.isInteger(id) && seen.has(id)) continue;
    const ev = reminderEventOf(ref);
    const list = out.get(ref.targetRef);
    if (list) list.push(ev);
    else out.set(ref.targetRef, [ev]);
  }
  return out;
}

/** My own reminder that is still live (not done, not cancelled). */
export function isLiveReminder(ev: CalendarEvent): boolean {
  return ev.feedType === "reminder" && toolboxIdOf(ev) != null && ev.status !== "done" && ev.status !== "cancelled";
}

/**
 * Whether Toolbox can cancel ONE store's copy of an event/task (`?stores=` on the cancel
 * call). It does since the backend fix in FRONTEND_CALENDAR_CHANGES.md (2026-11-06; before
 * it, `?stores=` was ignored and the whole event was cancelled). Keep it `false` when the
 * `.env.local` block points at a Toolbox that doesn't have that fix yet — there the dialog
 * says Cancel is for every store, and nothing sends `?stores=`.
 */
export const PER_STORE_CANCEL = true;

/** Events and tasks can be cancelled (by their creator) until they are over. */
export function isCancellable(ev: CalendarEvent): boolean {
  return (
    (ev.feedType === "calendar_event" || ev.feedType === "task") &&
    toolboxIdOf(ev) != null &&
    ev.status !== "cancelled" &&
    ev.status !== "done" &&
    taskStatusOf(ev) !== "approved"
  );
}

/**
 * Whether the Cancel button is worth showing to THIS viewer: the item can still
 * be cancelled, and the viewer may be its creator (see `mayBeCreator`).
 */
export function canCancel(ev: CalendarEvent, viewer: Viewer | null): boolean {
  return isCancellable(ev) && mayBeCreator(ev, viewer);
}

/** "Remind me" is offered on any real event except a reminder itself (and a roll-up, which has no single target). */
export function canRemind(ev: CalendarEvent): boolean {
  return !ev.members && ev.source !== "user" && ev.feedType !== "reminder" && !!ev.feedType;
}
