import type {
  CatalogTechnician,
  TechnicianAbilityBoard,
  TechnicianRating,
} from "@/types/maintenance-tickets.types";

/** Where a technician stands for one issue, from the coordinator's ratings. */
export interface TechnicianStanding {
  /** The one to call first for this issue. */
  callFirst: boolean;
  /** The one to call first for anything -- the go-to. */
  goTo: boolean;
  /** The stars shown: this issue's when rated for it, otherwise overall. */
  stars: number | null;
  /** True when `stars` are this issue's, false when they are overall. */
  starsForIssue: boolean;
  /** The notes behind those stars. */
  notes: string | null;
  /** They cover the ticket's store (false when no store was given). */
  coversStore: boolean;
}

export interface RankedTechnician {
  technician: CatalogTechnician;
  standing: TechnicianStanding;
}

export const EMPTY_BOARD: TechnicianAbilityBoard = { overall: [], byIssue: [] };

export function standingFor(
  technicianId: number,
  board: TechnicianAbilityBoard,
  catalogIssueId: number | null
): TechnicianStanding {
  const overall: TechnicianRating | undefined = board.overall.find((r) => r.technicianId === technicianId);
  const forIssue: TechnicianRating | undefined =
    catalogIssueId == null
      ? undefined
      : board.byIssue.find((r) => r.technicianId === technicianId && r.issueId === catalogIssueId);

  const issueRated = forIssue?.rating != null;
  const issueNotes = forIssue?.notes ?? null;

  return {
    callFirst: forIssue?.callFirst ?? false,
    goTo: overall?.callFirst ?? false,
    stars: forIssue?.rating ?? overall?.rating ?? null,
    starsForIssue: issueRated,
    // The issue's own notes when it has any say for this issue; else overall.
    notes: issueRated || issueNotes ? issueNotes : overall?.notes ?? null,
    coversStore: false,
  };
}

/** Whether a technician covers a store, given its number ("03795-00001") or id. */
export function coversStore(technician: CatalogTechnician, store: string | number | null | undefined): boolean {
  if (store == null || store === "") return false;
  return (technician.coverageStores ?? []).some((s) => s.storeNumber === String(store) || s.id === Number(store));
}

/**
 * Picker order: the one to call first for this issue, then the go-to for
 * anything, then by stars (this issue's, otherwise overall), then by name.
 *
 * Stars for the issue replace the overall stars rather than outranking the
 * go-to: two stars on Ovens means "not for Ovens", and must not lift someone
 * above the person the coordinator calls for everything. Unrated technicians
 * follow the rated ones, in name order. Pass a null issue (an "Other" issue,
 * or a visit across several) to rank on the overall ratings alone.
 *
 * Sorting only -- callers still decide who is listed at all.
 */
export function rankTechnicians(
  technicians: CatalogTechnician[],
  board: TechnicianAbilityBoard,
  catalogIssueId: number | null,
  /** The ticket's store: technicians who cover it come first. */
  store?: string | number | null,
): RankedTechnician[] {
  return technicians
    .map((technician) => ({
      technician,
      standing: { ...standingFor(technician.id, board, catalogIssueId), coversStore: coversStore(technician, store) },
    }))
    .sort((a, b) => {
      const sa = a.standing;
      const sb = b.standing;
      if (sa.coversStore !== sb.coversStore) return sa.coversStore ? -1 : 1;
      if (sa.callFirst !== sb.callFirst) return sa.callFirst ? -1 : 1;
      if (sa.goTo !== sb.goTo) return sa.goTo ? -1 : 1;
      const starsA = sa.stars ?? 0;
      const starsB = sb.stars ?? 0;
      if (starsA !== starsB) return starsB - starsA;
      return a.technician.name.localeCompare(b.technician.name);
    });
}

/**
 * The standing as short words, for pickers that only take text:
 * ["Call first", "Go-to", "★4"] or ["★3 overall"].
 */
export function standingWords(standing: TechnicianStanding): string[] {
  const words: string[] = [];
  if (standing.coversStore) words.push("Covers this store");
  if (standing.callFirst) words.push("Call first");
  if (standing.goTo) words.push("Go-to");
  if (standing.stars != null) words.push(`★${standing.stars}${standing.starsForIssue ? "" : " overall"}`);
  return words;
}

export function hasStanding(standing: TechnicianStanding): boolean {
  return standing.coversStore || standing.callFirst || standing.goTo || standing.stars != null || !!standing.notes;
}
