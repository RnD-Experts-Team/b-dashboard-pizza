/* ────────────────────────────────────────────────────────────────────────── */
/*  Nested multipart/form-data builder                                       */
/*                                                                            */
/*  Shared by the maintenance-tickets and storage services, both of which now */
/*  send nested payloads (notes[0][files][], lines[0][part_id]).              */
/*                                                                            */
/*  Deliberately SEPARATE from buildFormData in maintenance-tickets.service:  */
/*  six existing methods depend on that function's exact flat wire format,    */
/*  and changing it to be recursive would alter requests nobody asked to      */
/*  change. Named distinctly so nobody reaches for the wrong one.             */
/* ────────────────────────────────────────────────────────────────────────── */

function isFileLike(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !isFileLike(value)
  );
}

/**
 * Appends a value under a bracket-notation key, recursing into arrays and
 * objects:
 *
 *   File / Blob        → append(key, value)
 *   array of scalars   → `${key}[]` repeated       (ticket_issue_ids[])
 *   array of Files     → `${key}[]` repeated       (notes[0][files][])
 *   array of objects   → `${key}[i][...]`          (lines[0][part_id])
 *   plain object       → `${key}[subkey]`
 *   boolean            → "1" / "0"                 (Laravel-friendly)
 *   null / undefined   → skipped entirely
 *
 * ARRAY INDEXES MUST RUN CONTIGUOUSLY FROM 0 or the API silently drops
 * entries — a 201 with missing data rather than an error. Indexes here always
 * come from the array position, so callers must filter empty rows out BEFORE
 * calling rather than leaving holes.
 */
export function appendDeep(form: FormData, key: string, value: unknown): void {
  if (value == null) return;

  if (isFileLike(value)) {
    form.append(key, value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      if (item == null) return;
      if (isFileLike(item)) {
        form.append(`${key}[]`, item);
      } else if (isPlainObject(item) || Array.isArray(item)) {
        appendDeep(form, `${key}[${i}]`, item);
      } else {
        form.append(`${key}[]`, scalarToString(item));
      }
    });
    return;
  }

  if (isPlainObject(value)) {
    for (const [subKey, subValue] of Object.entries(value)) {
      appendDeep(form, `${key}[${subKey}]`, subValue);
    }
    return;
  }

  form.append(key, scalarToString(value));
}

function scalarToString(value: unknown): string {
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

/**
 * Builds a multipart body from a nested payload object, plus optional
 * top-level files under `files[]`.
 */
export function buildNestedFormData(payload: object, files?: File[]): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    appendDeep(form, key, value);
  }
  files?.forEach((file) => form.append("files[]", file));
  return form;
}

/** True when the payload carries a File anywhere, including inside notes. */
export function payloadHasFiles(payload: unknown): boolean {
  if (payload == null) return false;
  if (isFileLike(payload)) return true;
  if (Array.isArray(payload)) return payload.some(payloadHasFiles);
  if (isPlainObject(payload)) return Object.values(payload).some(payloadHasFiles);
  return false;
}
