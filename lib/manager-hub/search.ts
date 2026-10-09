/* ────────────────────────────────────────────────────────────────────────── */
/*  Hub search — one query matched against several fields of a row.          */
/*  Case- and accent-insensitive ("jose" finds "José"); every whitespace-    */
/*  separated word must appear somewhere, in any field, in any order.        */
/* ────────────────────────────────────────────────────────────────────────── */

export function normalizeSearch(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function searchTerms(query: string): string[] {
  return normalizeSearch(query).split(/\s+/).filter(Boolean);
}

export function matchesSearch(
  terms: string[],
  fields: (string | number | null | undefined)[],
): boolean {
  if (terms.length === 0) return true;
  const haystack = fields
    .filter((f) => f != null && f !== "")
    .map((f) => normalizeSearch(String(f)))
    .join(" \u0000 ");
  return terms.every((term) => haystack.includes(term));
}
