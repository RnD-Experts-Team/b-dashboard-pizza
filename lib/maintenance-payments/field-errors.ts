/* ────────────────────────────────────────────────────────────────────────── */
/*  Laravel 422 → per-field form errors (moved from lib/daily-pay)           */
/*                                                                            */
/*  The backend's dotted keys match the payload path exactly, in snake_case: */
/*                                                                            */
/*    paid_at · technician_id · supplier_id                                  */
/*    lines.0.hours                                                          */
/*    lines.1.trip_session_ids.2   ← collapses onto lines.1.trip_session_ids */
/*                                                                            */
/*  Errors stay in ONE flat map keyed by that path, so client-side and       */
/*  server-side validation render through one code path. Nothing is ever    */
/*  swallowed: a key no control claims goes to `form[]` (a banner).          */
/*                                                                            */
/*  Works for any v2 dialog, not just payments: pass the root fields it has */
/*  controls for, and the array names whose items have per-field controls. */
/*  A refused workflow step arrives as `errors.status` — list "status" as a */
/*  root field, or let it fall into the banner.                             */
/* ────────────────────────────────────────────────────────────────────────── */

import { camelToSnake } from "@/lib/api/maintenance-v2/http";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";

export interface FormErrors {
  /** Keyed by the server's dotted snake_case path; first message per key. */
  fields: Record<string, string>;
  /** Anything no control claims. */
  form: string[];
}

export const EMPTY_FORM_ERRORS: FormErrors = { fields: {}, form: [] };

export interface ErrorShape {
  /** Root fields that have a control ("paid_at", "technician_id"…). */
  rootFields?: readonly string[];
  /** Arrays whose items have per-field controls ("lines"). */
  itemArrays?: readonly string[];
}

const DOT = ".";

/**
 * A whole array index: "0", "12" match; "a", "1a", "" do not.
 * https://regex101.com/?flavor=javascript&regex=%5E%5Cd%2B%24&flags=gm&testString=0%0A12%0Aa%0A1a
 */
const ARRAY_INDEX = /^\d+$/;

/** The control a dotted key belongs to: `lines.1.trip_session_ids.2` → `lines.1.trip_session_ids`. */
function controlKey(rawKey: string, shape: ErrorShape): string | null {
  const parts = rawKey.split(DOT);
  const [root, index, field] = parts;
  if (shape.itemArrays?.includes(root) && index !== undefined && field !== undefined && ARRAY_INDEX.test(index)) {
    return [root, index, field].join(DOT);
  }
  if (shape.rootFields?.includes(root)) return root;
  return null;
}

/** Splits a Laravel error bag into per-field and form-level messages. */
export function parseValidationErrors(errors: Record<string, string[]> | undefined, shape: ErrorShape = {}): FormErrors {
  return Object.entries(errors ?? {}).reduce<FormErrors>(
    (acc, [rawKey, messages]) => {
      const message = messages?.[0];
      if (!message) return acc;
      const key = controlKey(rawKey, shape);
      if (key && !acc.fields[key]) return { ...acc, fields: { ...acc.fields, [key]: message } };
      if (key) return acc;
      return { ...acc, form: [...acc.form, message] };
    },
    { fields: {}, form: [] },
  );
}

/** From a thrown error: its 422 fields, or its message as a form-level error. */
export function formErrorsFrom(err: unknown, shape: ErrorShape = {}): FormErrors {
  if (err instanceof MaintenanceTicketsError && err.code === "VALIDATION_ERROR") {
    const parsed = parseValidationErrors(err.validationErrors, shape);
    const hasAny = Object.keys(parsed.fields).length || parsed.form.length;
    return hasAny ? parsed : { fields: {}, form: [err.message] };
  }
  if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return EMPTY_FORM_ERRORS;
  return { fields: {}, form: [err instanceof Error ? err.message : "Something went wrong."] };
}

/** `lines.<i>.<field>` for a camelCase draft field. */
export function lineErrorKey(lineIndex: number, field: string): string {
  return ["lines", String(lineIndex), camelToSnake(field)].join(DOT);
}

/** A root key for a camelCase draft field. */
export function rootErrorKey(field: string): string {
  return camelToSnake(field);
}

export function lineError(errors: FormErrors, lineIndex: number, field: string): string | undefined {
  return errors.fields[lineErrorKey(lineIndex, field)];
}

/** True when any error targets this line. */
export function lineHasError(errors: FormErrors, lineIndex: number): boolean {
  const prefix = `lines.${lineIndex}.`;
  return Object.keys(errors.fields).some((key) => key.startsWith(prefix));
}

/** The first errored key in form order (root fields first, then lines by index), to focus it. */
export function firstErrorKey(errors: FormErrors, rootOrder: readonly string[] = []): string | null {
  const keys = Object.keys(errors.fields);
  const root = rootOrder.find((k) => keys.includes(k));
  if (root) return root;
  const lineKeys = keys
    .map((k) => ({ k, i: Number(k.split(DOT)[1]) }))
    .filter((x) => Number.isFinite(x.i))
    .sort((a, b) => a.i - b.i);
  return lineKeys[0]?.k ?? keys[0] ?? null;
}

export function errorCount(errors: FormErrors): number {
  return Object.keys(errors.fields).length + errors.form.length;
}

/** Drops one field's error, so it clears as the user types. */
export function clearFieldError(errors: FormErrors, key: string): FormErrors {
  if (!errors.fields[key]) return errors;
  const fields = Object.fromEntries(Object.entries(errors.fields).filter(([k]) => k !== key));
  return { fields, form: errors.form };
}
