/**
 * The form of a name two records may not share — EXACTLY the backend's
 * `App\Support\NameKey::of()`: trimmed, inner runs of whitespace collapsed to
 * one space, lower-cased. "Ahmed  Ali", " ahmed ali" and "AHMED ALI" are one
 * key, so the add/edit dialogs can say "There is already a technician called
 * X" while the person types, before the server's 422 says the same.
 */

/**
 * Any run of whitespace (spaces, tabs, newlines): "Ahmed \t Ali" → "Ahmed Ali"; "Ahmed Ali" is unchanged.
 * https://regex101.com/?flavor=javascript&regex=%5Cs%2B&flags=gu&testString=Ahmed%20%20%09%20Ali%0AAhmed%20Ali
 */
const WHITESPACE_RUN = /\s+/gu;

/** The name as stored: trimmed, whitespace collapsed, capitalisation kept. */
export function tidyName(name: string | null | undefined): string {
  return (name ?? "").trim().replace(WHITESPACE_RUN, " ");
}

/** The uniqueness key: tidyName, lower-cased. */
export function nameKey(name: string | null | undefined): string {
  return tidyName(name).toLowerCase();
}

/**
 * The row that already uses this name, if any (ignoring `exceptId`, the row
 * being edited). Empty names never collide.
 */
export function findNameClash<T extends { id: number; name: string }>(
  name: string,
  rows: readonly T[],
  exceptId?: number | null,
): T | null {
  const k = nameKey(name);
  if (!k) return null;
  return rows.find((row) => row.id !== exceptId && nameKey(row.name) === k) ?? null;
}
