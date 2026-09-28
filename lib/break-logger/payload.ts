import type {
  BreakEntry,
  BreakHistoryFilters,
  CreateBreakInput,
  UpdateBreakInput,
} from "@/types/breaks.types";
import { localInputToIso, sameMinute } from "./work-date";

export const CUSTOM_LABEL_MAX = 120;
export const NOTE_MAX = 2000;
export const MINUTES_MIN = 1;
export const MINUTES_MAX = 1440;

/** Whitespace-only counts as absent, exactly as the API treats it. */
export function cleanLabel(value: string | null | undefined): string | undefined {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, CUSTOM_LABEL_MAX) : undefined;
}

/** What the manual-entry / edit form holds. Times are datetime-local strings. */
export interface BreakFormState {
  breakTypeId: number | null;
  requiresCustomLabel: boolean;
  otherLabel: string;
  startedAt: string;
  endedAt: string;
  /** Edit only: the break is (or should stay) running — no end. */
  stillRunning: boolean;
}

/**
 * Body for `POST breaks` (manual). `other_label` is sent ONLY for a type that
 * requires it — sending it on any other type is a hard 422.
 */
export function buildCreatePayload(form: BreakFormState): CreateBreakInput | null {
  const started = localInputToIso(form.startedAt);
  const ended = localInputToIso(form.endedAt);
  if (form.breakTypeId == null || !started || !ended) return null;
  const payload: CreateBreakInput = {
    break_type_id: form.breakTypeId,
    started_at: started,
    ended_at: ended,
  };
  const label = cleanLabel(form.otherLabel);
  if (form.requiresCustomLabel && label) payload.other_label = label;
  return payload;
}

/**
 * Body for `POST breaks/{id}` — ONLY the keys that changed.
 *
 * - `ended_at` is omitted unless the end moved. It is sent as `null` only
 *   when the user explicitly turned a finished break back into a running one;
 *   a stray null would reopen the break and the next start would 409.
 * - Moving away from a custom type sends `other_label: null` explicitly, or
 *   the stored label carries forward and trips BREAK_CUSTOM_LABEL_NOT_ALLOWED.
 */
export function buildUpdatePayload(
  original: BreakEntry,
  form: BreakFormState
): UpdateBreakInput {
  const payload: UpdateBreakInput = {};

  if (form.breakTypeId != null && form.breakTypeId !== original.break_type.id) {
    payload.break_type_id = form.breakTypeId;
  }

  const label = cleanLabel(form.otherLabel) ?? null;
  if (form.requiresCustomLabel) {
    if (label !== (original.other_label ?? null)) payload.other_label = label;
  } else if (original.other_label != null) {
    payload.other_label = null;
  }

  const started = localInputToIso(form.startedAt);
  if (started && !sameMinute(started, original.started_at)) {
    payload.started_at = started;
  }

  if (form.stillRunning) {
    if (!original.running) payload.ended_at = null; // explicit reopen
  } else {
    const ended = localInputToIso(form.endedAt);
    if (ended && !sameMinute(ended, original.ended_at)) payload.ended_at = ended;
  }

  return payload;
}

export function clampPerPage(n: number | undefined): number {
  if (!n || Number.isNaN(n)) return 25;
  return Math.min(200, Math.max(1, Math.floor(n)));
}

/**
 * Query string for `GET breaks`. Booleans go as `0`/`1` — PHP reads the
 * string "false" as true — and "both" omits the key entirely.
 */
export function historyQuery(filters: BreakHistoryFilters): URLSearchParams {
  const qs = new URLSearchParams();
  if (filters.from) qs.set("from", filters.from);
  if (filters.to) qs.set("to", filters.to);
  if (filters.source) qs.set("source", filters.source);
  if (filters.countsTowardLimit !== undefined) {
    qs.set("counts_toward_limit", filters.countsTowardLimit ? "1" : "0");
  }
  for (const id of filters.breakTypeIds ?? []) qs.append("break_type_ids[]", String(id));
  qs.set("per_page", String(clampPerPage(filters.perPage)));
  qs.set("page", String(Math.max(1, filters.page ?? 1)));
  return qs;
}

/** Normalise a milestone list the way the server will: ints in range, unique, ascending. */
export function normaliseThresholds(values: number[]): number[] {
  return Array.from(
    new Set(
      values
        .map((v) => Math.floor(v))
        .filter((v) => Number.isFinite(v) && v >= MINUTES_MIN && v <= MINUTES_MAX)
    )
  ).sort((a, b) => a - b);
}
