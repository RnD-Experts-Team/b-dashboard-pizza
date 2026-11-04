import type { CalendarEvent } from "./types";

/**
 * What the Calendar writes to Toolbox (FRONTEND_CALENDAR_GUIDE §8): events,
 * tasks and reminders. Pure functions — no React, no network.
 */

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type TaskAction = "start" | "submit" | "approve" | "return";
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
  /** Store numbers (`03795-00001`), 1 to 50. */
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
    stores: input.stores,
    date: input.date,
    priority: input.priority,
    ...put("description", input.description?.trim()),
    ...put("category", input.category?.trim()),
    ...put("start_time", input.startTime),
  };
  if (input.type === "event") return { ...base, ...put("end_time", input.endTime) };
  return { ...base, task: { proof: input.proof, requires_review: input.requiresReview } };
}

/** Toolbox's own number for an event: the third part of its id (`toolbox:task:42:03795-00001` → 42). */
export function toolboxIdOf(ev: CalendarEvent): number | null {
  if (ev.origin !== "toolbox") return null;
  const n = Number(ev.id.split(":")[2]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const taskStatusOf = (ev: CalendarEvent): string | null =>
  typeof ev.extra?.task_status === "string" ? ev.extra.task_status : null;

/**
 * What the store can do next with a task (the lifecycle in guide §8.3). Approve
 * and return belong to the task's creator; the feed doesn't say who that is, so
 * they are offered on a submitted task and Toolbox answers 403 to anyone else.
 */
export function taskActionsFor(ev: CalendarEvent): TaskAction[] {
  if (ev.feedType !== "task" || toolboxIdOf(ev) == null) return [];
  switch (taskStatusOf(ev)) {
    case "open":
    case "returned":
      return ["start", "submit"];
    case "in_progress":
      return ["submit"];
    case "submitted":
      return ["approve", "return"];
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

/** "Remind me" is offered on any real event except a reminder itself (and a roll-up, which has no single target). */
export function canRemind(ev: CalendarEvent): boolean {
  return !ev.members && ev.source !== "user" && ev.feedType !== "reminder" && !!ev.feedType;
}
