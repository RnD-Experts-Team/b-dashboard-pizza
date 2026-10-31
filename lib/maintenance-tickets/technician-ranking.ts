/**
 * Where a technician stands for a ticket, for the technician picker
 * (docs/MAINTENANCE-UI.md §2 "Book inspection / Schedule work": badges
 * covers store · covers issue · emergency · call first · ★rating).
 *
 * Ranking happens on the SERVER: `GET technicians?store=&issue_id=&urgent=` returns
 * the list in order (covers store → covers issue → emergency when urgent →
 * call first → rating → name), each row with `standing`. This file only turns
 * that standing into badges/words; it never re-sorts.
 */

import type { Technician } from "@/types/maintenance-system";

export interface TechnicianStandingView {
  coversStore: boolean;
  coversIssue: boolean;
  callFirst: boolean;
  emergency: boolean;
  /** This issue's stars when rated for it, else the technician's average. */
  stars: number | null;
  /** True when `stars` is this issue's rating, false when it is the average. */
  starsForIssue: boolean;
}

export function standingOf(technician: Technician): TechnicianStandingView {
  const s = technician.standing;
  const average = technician.averageRating == null ? null : Number(technician.averageRating);
  const issueStars = s?.rating ?? null;
  return {
    coversStore: Boolean(s?.coversStore),
    coversIssue: Boolean(s?.coversIssue),
    callFirst: Boolean(s?.callFirst),
    emergency: technician.emergencyAvailable,
    stars: issueStars ?? (Number.isFinite(average) ? average : null),
    starsForIssue: issueStars != null,
  };
}

/** The standing as short words, for pickers that only take text. */
export function standingWords(standing: TechnicianStandingView): string[] {
  const words: [boolean, string][] = [
    [standing.coversStore, "Covers store"],
    [standing.coversIssue, "Covers issue"],
    [standing.emergency, "Emergency"],
    [standing.callFirst, "Call first"],
    [standing.stars != null, `★${standing.stars ?? ""}${standing.starsForIssue ? "" : " avg"}`],
  ];
  return words.filter(([on]) => on).map(([, word]) => word);
}

export function hasStanding(standing: TechnicianStandingView): boolean {
  return standingWords(standing).length > 0;
}

/** Whether a technician covers a store, given its number ("03795-00001") or id. */
export function coversStore(technician: Technician, store: string | number | null | undefined): boolean {
  if (store == null || store === "") return false;
  return technician.coverageStores.some((s) => s.storeNumber === String(store) || s.id === Number(store));
}
