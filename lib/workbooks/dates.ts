/* ────────────────────────────────────────────────────────────────────────── */
/*  Timestamps — pure.                                                       */
/*                                                                            */
/*  For `created_at` / `updated_at`, which are real moments in time           */
/*  ("2026-09-23T10:00:00+00:00"), so `new Date()` is correct here and the    */
/*  viewer's own time zone is what they expect to see.                        */
/*                                                                            */
/*  NOT for cell values of a date column — those are calendar days, read by  */
/*  `datePart` in cells.ts and never passed through `new Date()`.            */
/* ────────────────────────────────────────────────────────────────────────── */

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Sep 23, 2026" — short, for card meta lines. */
export function formatDay(iso: string | null | undefined, locale = "en"): string | null {
  const d = parse(iso);
  if (!d) return null;
  try {
    return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso ?? null;
  }
}

/** "Sep 23, 2026, 10:00 AM" — full, for tooltips. */
export function formatTimestamp(iso: string | null | undefined, locale = "en"): string | null {
  const d = parse(iso);
  if (!d) return null;
  try {
    return d.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso ?? null;
  }
}

/** True when the item was edited after it was created (worth saying "updated"). */
export function wasUpdated(createdAt: string | null | undefined, updatedAt: string | null | undefined): boolean {
  const c = parse(createdAt);
  const u = parse(updatedAt);
  return Boolean(c && u && u.getTime() - c.getTime() > 1000);
}
