/* ────────────────────────────────────────────────────────────────────────── */
/*  Daily Pay — Laravel 422 → per-field form errors                          */
/*                                                                            */
/*  The backend sends standard Laravel 422 bodies whose dotted keys match the */
/*  payload path exactly:                                                     */
/*                                                                            */
/*    date                                                                    */
/*    payments.0.technician_id            ← e.g. a duplicate payee            */
/*    payments.1.lines.2.store_id                                             */
/*    payments.1.lines.2.ticket_issue_ids ← payee not assigned to an issue    */
/*                                                                            */
/*  Errors are kept in ONE flat map keyed by the server's own path, so client- */
/*  side and server-side validation render through a single code path. Nothing */
/*  is ever swallowed: an unrecognised key goes to `form[]` and shows in a     */
/*  banner rather than being dropped.                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export interface DailyPayFormErrors {
  /** Keyed by the server's dotted path. Values are the first message per key. */
  fields: Record<string, string>;
  /** Anything that did not match a known field path, rendered form-level. */
  form: string[];
}

export const EMPTY_FORM_ERRORS: DailyPayFormErrors = { fields: {}, form: [] };

/** payments.<i>[.lines.<j>][.<field...>] */
const PATH = /^payments\.(\d+)(?:\.lines\.(\d+))?(?:\.(.+))?$/;

/**
 * Top-level keys that have a control to render against.
 *
 * `expected_updated_at` is deliberately NOT here: it is a hidden field with no
 * visible input, so mapping it to `fields` would render it nowhere. It falls
 * through to `form[]` instead, where the banner shows it. (A stale edit comes
 * back as a 409, not a 422 — this is only for a malformed timestamp.)
 */
const KNOWN_ROOT_FIELDS = new Set(["date"]);

export function paymentKey(paymentIndex: number, field: string): string {
  return `payments.${paymentIndex}.${field}`;
}

export function lineKey(paymentIndex: number, lineIndex: number, field: string): string {
  return `payments.${paymentIndex}.lines.${lineIndex}.${field}`;
}

/**
 * Splits a Laravel error bag into per-field and form-level messages.
 *
 * Sub-paths collapse onto their control: `payments.0.lines.1.ticket_issue_ids.3`
 * lands on that line's `ticket_issue_ids`, because there is one picker for the
 * whole array and no per-element control to point at.
 */
export function parseValidationErrors(
  errors: Record<string, string[]> | undefined
): DailyPayFormErrors {
  const fields: Record<string, string> = {};
  const form: string[] = [];
  if (!errors) return { fields, form };

  for (const [rawKey, messages] of Object.entries(errors)) {
    const message = messages?.[0];
    if (!message) continue;

    if (KNOWN_ROOT_FIELDS.has(rawKey)) {
      if (!fields[rawKey]) fields[rawKey] = message;
      continue;
    }

    const match = PATH.exec(rawKey);
    if (!match) {
      // Includes bare `payments`, `payments.0.lines`, and anything unexpected.
      form.push(message);
      continue;
    }

    const [, paymentIndex, lineIndex, field] = match;
    if (!field) {
      // "payments.0" with no field — a whole-payment complaint.
      form.push(message);
      continue;
    }

    // Collapse array-element sub-paths onto the control that owns the array.
    //
    // This also lands `payments.0.lines` (a whole-array complaint, e.g. "at
    // least one line") on the payment card's own `lines` slot, which is the
    // same key validateFormState uses — so it renders in context rather than
    // in the generic form-level banner.
    const controlField = field.split(".")[0];
    const key =
      lineIndex != null
        ? lineKey(Number(paymentIndex), Number(lineIndex), controlField)
        : paymentKey(Number(paymentIndex), controlField);

    if (!fields[key]) fields[key] = message;
  }

  return { fields, form };
}

export function paymentError(
  errors: DailyPayFormErrors,
  paymentIndex: number,
  field: string
): string | undefined {
  return errors.fields[paymentKey(paymentIndex, field)];
}

export function lineError(
  errors: DailyPayFormErrors,
  paymentIndex: number,
  lineIndex: number,
  field: string
): string | undefined {
  return errors.fields[lineKey(paymentIndex, lineIndex, field)];
}

/** True when any error targets this payment or one of its lines. */
export function paymentHasError(errors: DailyPayFormErrors, paymentIndex: number): boolean {
  const prefix = `payments.${paymentIndex}.`;
  return Object.keys(errors.fields).some((key) => key.startsWith(prefix));
}

/** Index of the first payment carrying an error, for scroll-into-view. */
export function firstErroredPaymentIndex(errors: DailyPayFormErrors): number | null {
  let lowest: number | null = null;
  for (const key of Object.keys(errors.fields)) {
    const match = PATH.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    if (lowest == null || index < lowest) lowest = index;
  }
  return lowest;
}

/** Total count, for the summary toast. */
export function errorCount(errors: DailyPayFormErrors): number {
  return Object.keys(errors.fields).length + errors.form.length;
}

/** Drops one field's error, so it clears as the user types. */
export function clearFieldError(
  errors: DailyPayFormErrors,
  key: string
): DailyPayFormErrors {
  if (!errors.fields[key]) return errors;
  const fields = { ...errors.fields };
  delete fields[key];
  return { fields, form: errors.form };
}
