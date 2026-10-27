import type { Skill, SkillsOverviewEmployee } from "@/types/skills.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Employee skills overview — pure logic (no React)                          */
/*                                                                            */
/*  Filters and stats run on the client: one overview response carries every */
/*  employee of the picked stores, so narrowing it never needs a round trip.  */
/* ────────────────────────────────────────────────────────────────────────── */

export const STATUS_FILTERS = ["all", "alerts", "minors", "incomplete", "unrated"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/** "any" = no rating filter, "none" = not rated, "1".."5" = at least that many stars. */
export const RATING_FILTERS = ["any", "none", "1", "2", "3", "4", "5"] as const;
export type RatingFilter = (typeof RATING_FILTERS)[number];

export interface OverviewFilters {
  search: string;
  status: StatusFilter;
  /** A skill id, or "all". */
  skill: string;
  rating: RatingFilter;
}

export const EMPTY_FILTERS: OverviewFilters = { search: "", status: "all", skill: "all", rating: "any" };

export function activeFilterCount(f: OverviewFilters): number {
  return [f.search.trim() !== "", f.status !== "all", f.skill !== "all", f.rating !== "any"].filter(Boolean).length;
}

export function ratedCount(e: SkillsOverviewEmployee): number {
  return Object.keys(e.ratings).length;
}

/** Average stars over the skills they are rated on; null when none. */
export function averageRating(e: SkillsOverviewEmployee): number | null {
  const values = Object.values(e.ratings).map((r) => r.rating);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

const STATUS_MATCHERS: Record<StatusFilter, (e: SkillsOverviewEmployee, skillCount: number) => boolean> = {
  all: () => true,
  alerts: (e) => e.alert_skill_ids.length > 0,
  minors: (e) => e.is_minor === true,
  incomplete: (e, skillCount) => ratedCount(e) < skillCount,
  unrated: (e) => ratedCount(e) === 0,
};

function matchesStatus(e: SkillsOverviewEmployee, status: StatusFilter, skillCount: number): boolean {
  return STATUS_MATCHERS[status](e, skillCount);
}

/** With a skill: that skill's stars. Without one: the employee's average. */
function matchesRating(e: SkillsOverviewEmployee, skill: string, rating: RatingFilter): boolean {
  if (rating === "any") return true;
  const stars = skill === "all" ? averageRating(e) : e.ratings[skill]?.rating ?? null;
  if (rating === "none") return stars === null;
  return stars !== null && stars >= Number(rating);
}

export function filterEmployees(
  employees: SkillsOverviewEmployee[],
  skills: Skill[],
  f: OverviewFilters,
): SkillsOverviewEmployee[] {
  const needle = f.search.trim().toLowerCase();
  return employees.filter(
    (e) =>
      (needle === "" || e.name.toLowerCase().includes(needle)) &&
      matchesStatus(e, f.status, skills.length) &&
      matchesRating(e, f.skill, f.rating),
  );
}

export interface OverviewStats {
  employees: number;
  /** Rated cells over employees × skills, 0–100; null with nothing to rate. */
  coveragePct: number | null;
  averageStars: number | null;
  fullyRated: number;
  minors: number;
  /** Employees with at least one alert (a minor rated on a restricted skill). */
  alerted: number;
  noBirthDate: number;
}

const PERCENT = 100;

export function overviewStats(employees: SkillsOverviewEmployee[], skills: Skill[]): OverviewStats {
  const cells = employees.length * skills.length;
  const ratings = employees.flatMap((e) => Object.values(e.ratings).map((r) => r.rating));
  return {
    employees: employees.length,
    coveragePct: cells === 0 ? null : Math.round((ratings.length / cells) * PERCENT),
    averageStars: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    fullyRated: employees.filter((e) => skills.length > 0 && ratedCount(e) >= skills.length).length,
    minors: employees.filter((e) => e.is_minor === true).length,
    alerted: employees.filter((e) => e.alert_skill_ids.length > 0).length,
    noBirthDate: employees.filter((e) => e.is_minor === null).length,
  };
}

export interface SkillColumnStats {
  rated: number;
  average: number | null;
}

/** Per skill: how many of these employees are rated on it, and their average. */
export function skillColumnStats(employees: SkillsOverviewEmployee[], skill: Skill): SkillColumnStats {
  const values = employees.flatMap((e) => (e.ratings[skill.id] ? [e.ratings[skill.id].rating] : []));
  return {
    rated: values.length,
    average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
  };
}
