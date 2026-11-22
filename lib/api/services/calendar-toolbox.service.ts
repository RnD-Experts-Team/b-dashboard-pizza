import axios from "axios";
import {
  parsePeopleList,
  parseReminderList,
  toCreatePayload,
  type CalendarPerson,
  type CreateItemInput,
  type ReminderAction,
  type ReminderRef,
  type TaskAction,
  type WriteTarget,
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

/** `GET /calendar/people` answers at most this many, with no paging and no store filter. */
const PEOPLE_CAP = 100;
/** The whole list of store managers is kept this long (it changes rarely). */
const PEOPLE_TTL_MS = 5 * 60_000;
/** Searches asked at once while gathering the whole list. */
const PEOPLE_PARALLEL = 9;
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

/** Every store manager, as far as Toolbox let us gather them. */
export interface PeopleDirectory {
  people: CalendarPerson[];
  /** false when some of the searches failed — a few managers may be missing. */
  complete: boolean;
}

let peopleCache: { at: number; promise: Promise<PeopleDirectory> } | null = null;

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

/**
 * A target as query parameters: one store (`stores`), or one person — `user` on a
 * task action (the creator's approve / return), `users` on a cancel (comma list).
 */
function targetParams(target: WriteTarget | undefined, call: "task" | "cancel"): Record<string, string> | undefined {
  if (!target) return undefined;
  if ("store" in target) return { stores: target.store };
  return call === "task" ? { user: target.user } : { users: target.user };
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
   * Creator only. Without a target the whole item is cancelled everywhere. With one
   * (`cancelTargetFor`; FRONTEND_CALENDAR_CHANGES.md) only that copy is — one store
   * (`?stores=`) or one person (`?users=`): a plain event leaves their calendar for
   * good, a task stays there as `cancelled`, an approved one stays done; cancelling
   * the last copy cancels the item everywhere. A 422 ("not in every store sent",
   * "Nothing to cancel there") carries its own message.
   */
  cancelEvent(id: number, target?: WriteTarget): Promise<void> {
    return post(`/events/${id}/cancel`, {}, targetParams(target, "cancel"));
  },

  /**
   * `target` from `taskTargetFor`: the ONE store a store task is worked in, the person
   * a "Chosen people" task is approved / returned for, or nothing (a private task's
   * done / reopen, a person's own start / submit). `note` is required when the task
   * asks for proof; `reason` when returning.
   */
  taskAction(id: number, action: TaskAction, target: WriteTarget, body: { note?: string; reason?: string } = {}): Promise<void> {
    return post(`/tasks/${id}/${action}`, body, targetParams(target, "task"));
  },

  /**
   * The store managers a "Chosen people" item can be given to, searched by name
   * (`q`; up to 100, by name). Throws a `CalendarWriteError` so the picker can say
   * why it is empty (a 404 before Toolbox ships the feature, a 403, offline).
   */
  async listPeople(q: string, opts: { signal?: AbortSignal } = {}): Promise<CalendarPerson[]> {
    try {
      const { data } = await axios.get(`${BASE}/people`, {
        headers: headers(),
        timeout: TIMEOUT_MS,
        params: q.trim() ? { q: q.trim() } : undefined,
        signal: opts.signal,
      });
      return parsePeopleList(data);
    } catch (err) {
      throw toError(err);
    }
  },

  /**
   * EVERY store manager, so the picker can offer the managers of the stores picked.
   * Toolbox answers at most 100 per call, with no paging and no store filter (checked
   * 2026-11-22: `store`, `stores`, `page` are ignored; testing has ~157 managers). So
   * when the plain list comes back full, the list is gathered from one search per letter
   * (`q` matches anywhere in the name, so every name turns up under one of its letters)
   * and merged by id. Kept 5 minutes and shared by every picker; a failure is not kept.
   * Throws a `CalendarWriteError` when even the first call fails.
   * TODO(backend): a `?store=` filter (or a higher cap) on /calendar/people would replace
   * the letter searches with one call.
   */
  listAllPeople(opts: { fresh?: boolean } = {}): Promise<PeopleDirectory> {
    if (!opts.fresh && peopleCache && Date.now() - peopleCache.at < PEOPLE_TTL_MS) return peopleCache.promise;
    const promise = (async (): Promise<PeopleDirectory> => {
      const first = await calendarToolboxService.listPeople("");
      if (first.length < PEOPLE_CAP) return { people: first, complete: true };
      const byId = new Map(first.map((p) => [p.id, p]));
      let failed = 0;
      const queue = [...LETTERS];
      const worker = async () => {
        for (let q = queue.shift(); q; q = queue.shift()) {
          try {
            for (const p of await calendarToolboxService.listPeople(q)) byId.set(p.id, p);
          } catch {
            failed++;
          }
        }
      };
      await Promise.all(Array.from({ length: PEOPLE_PARALLEL }, worker));
      return {
        people: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)),
        complete: failed === 0,
      };
    })();
    peopleCache = { at: Date.now(), promise };
    // A failed or partial load is not kept: the next opening asks again.
    promise.then(
      (d) => {
        if (!d.complete && peopleCache?.promise === promise) peopleCache = null;
      },
      () => {
        if (peopleCache?.promise === promise) peopleCache = null;
      },
    );
    return promise;
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
