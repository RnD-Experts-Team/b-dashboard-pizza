/**
 * Plain text from an announcement's HTML body, and the feed's search.
 *
 * Client only: the bodies come from client-side fetches, so `DOMParser` is
 * there whenever these run. Without it they return "" / no match.
 */

const cache = new Map<string, string>();
const CACHE_LIMIT = 300;

/** The text of an HTML body on one line (tags gone, whitespace collapsed). */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const hit = cache.get(html);
  if (hit !== undefined) return hit;
  if (typeof DOMParser === "undefined") return "";

  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(html, text);
  return text;
}

/**
 * Does the announcement match the search box? Every word has to appear in the
 * title or the body text, in any order, ignoring case. An empty search matches
 * everything.
 */
export function matchesQuery(
  announcement: { title: string; body: string },
  query: string,
): boolean {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${announcement.title} ${htmlToText(announcement.body)}`.toLocaleLowerCase();
  return words.every((word) => haystack.includes(word));
}
