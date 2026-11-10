import axios from "axios";
import {
  isPrivateTaskAction,
  parseReminderList,
  toCreatePayload,
  type CreateItemInput,
  type ReminderAction,
  type ReminderRef,
  type TaskAction,
} from "@/lib/calendar/toolbox-write";
import { invalidateFeedSource } from "./calendar-feed.service";

/**
 * Calendar writes — events, tasks and reminders in ToolboxPizza
 * (FRONTEND_CALENDAR_GUIDE §8), through `/api/toolbox/calendar/*`.
 *
 * Plain axios with the bearer token from the persisted auth store (same as
 * `toolbox-tickets.service.ts`), never `axiosClient`, whose 401 interceptor
 * would sign the user out. Every failure becomes one `CalendarWriteError`.
 * A write changes only the Toolbox feed, so that one source's cache is dropped
 * and the next load re-asks it (the other seven stay cached).
 */

const BASE = "/api/toolbox/calendar";
const TIMEOUT_MS = 30_000;

export type CalendarWriteErrorKind = "auth" | "forbidden" | "notFound" | "invalid" | "network" | "other";

export class CalendarWriteError extends Error {
  constructor(
    readonly kind: CalendarWriteErrorKind,
    message: string,
    /** Laravel's per-field messages (422), e.g. `{ stores: ["Unknown store: …"] }`. */
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "CalendarWriteError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("auth-token") ?? "null")?.state?.token ?? null;
  } catch {
    return null;
  }
}

function headers(): Record<string, string> {
  const token = getToken();
  if (!token) throw new CalendarWriteError("auth", "Not signed in.");
  return { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
}

interface ErrorBody {
  message?: unknown;
  errors?: unknown;
  error?: { message?: unknown };
}

function toError(err: unknown): CalendarWriteError {
  if (err instanceof CalendarWriteError) return err;
  if (!axios.isAxiosError(err) || !err.response) return new CalendarWriteError("network", "Could not reach the server.");
  const { status, data } = err.response as { status: number; data: ErrorBody | null };
  const text = typeof data?.message === "string" ? data.message : typeof data?.error?.message === "string" ? data.error.message : "";
  const fields: Record<string, string[]> = {};
  if (data?.errors && typeof data.errors === "object") {
    for (const [k, v] of Object.entries(data.errors as Record<string, unknown>)) {
      if (Array.isArray(v)) fields[k] = v.filter((m): m is string => typeof m === "string");
    }
  }
  if (status === 401) return new CalendarWriteError("auth", text || "Session expired.");
  if (status === 403) return new CalendarWriteError("forbidden", text || "Not allowed.");
  if (status === 404) return new CalendarWriteError("notFound", text || "Not found.");
  if (status === 422) return new CalendarWriteError("invalid", text || "Check the form.", fields);
  return new CalendarWriteError("other", text || `Request failed (${status}).`);
}

async function post(path: string, body: unknown, params?: Record<string, string>): Promise<void> {
  try {
    await axios.post(`${BASE}${path}`, body ?? {}, { headers: headers(), timeout: TIMEOUT_MS, params });
  } catch (err) {
    throw toError(err);
  } finally {
    // Even a failed write may have landed (timeout): never serve the old answer.
    invalidateFeedSource("toolbox");
  }
}

export const calendarToolboxService = {
  /** Create an event, a task (per store) or a reminder (mine). */
  createItem(input: CreateItemInput): Promise<void> {
    return post("/events", toCreatePayload(input));
  },

  /**
   * Creator only. Without `store` the whole item is cancelled in every store it was
   * sent to. With `store` (`?stores=`; FRONTEND_CALENDAR_CHANGES.md) only that store's
   * copy is: a plain event leaves that store for good, a task stays there as
   * `cancelled`; cancelling the last store cancels the item everywhere. A 422
   * ("not in every store sent", "Nothing to cancel there") carries its own message.
   */
  cancelEvent(id: number, store?: string): Promise<void> {
    return post(`/events/${id}/cancel`, {}, store ? { stores: store } : undefined);
  },

  /**
   * `store` is the ONE store the task is worked in. `note` is required when the
   * task asks for proof; `reason` when returning. A private task's `done` /
   * `reopen` go without a store (guide §8.3.1).
   */
  taskAction(id: number, action: TaskAction, store: string, body: { note?: string; reason?: string } = {}): Promise<void> {
    return post(`/tasks/${id}/${action}`, body, isPrivateTaskAction(action) ? undefined : { stores: store });
  },

  /**
   * All my reminders (upcoming and rung), so an event can say "a reminder is set"
   * even when it rings on a day the view isn't showing. A read: it never throws —
   * without the list the Calendar still shows the reminders the feed carries.
   */
  async listReminders(): Promise<ReminderRef[]> {
    try {
      const { data } = await axios.get(`${BASE}/reminders`, { headers: headers(), timeout: TIMEOUT_MS });
      return parseReminderList(data);
    } catch {
      return [];
    }
  },

  reminderAction(id: number, action: ReminderAction, body: { minutes?: number } = {}): Promise<void> {
    return post(`/reminders/${id}/${action}`, body);
  },
};
