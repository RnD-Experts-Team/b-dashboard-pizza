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

/** My own reminder that is still live (not done, not cancelled). */
export function isLiveReminder(ev: CalendarEvent): boolean {
  return ev.feedType === "reminder" && toolboxIdOf(ev) != null && ev.status !== "done" && ev.status !== "cancelled";
}

/**
 * Whether Toolbox can cancel ONE store's copy of an event/task (`?stores=` on the cancel
 * call). It can't yet: on 2026-11-05 `POST …/events/43/cancel?stores=03795-00038` answered
 * 200 and cancelled the whole event (`cancelled_at` set, every store still in `stores`), so
 * the cancel dialog says it cancels everywhere. Flip to `true` once the backend honours it.
 */
export const PER_STORE_CANCEL = false;

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
