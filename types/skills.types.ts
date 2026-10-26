/* ------------------------------------------------------------------ */
/*  Employee skills (OperationsPizza)                                  */
/* ------------------------------------------------------------------ */

/**
 * One skill on the shared list. `min_age` set means employees younger than it
 * should not work on, be near, or be trained on it — a warning, never a block.
 */
export interface Skill {
  id: string;
  name: string;
  min_age: number | null;
  restriction_note: string | null;
}

export interface SkillDraft {
  name: string;
  min_age: number | null;
  restriction_note: string | null;
}

/**
 * The employee as the skills endpoints describe them. The birth date never
 * leaves the API: `is_minor` is null when hiring has none on file.
 */
export interface SkillsEmployee {
  id: string;
  name: string;
  is_active: boolean;
  is_minor: boolean | null;
}

/** One skill for one employee, rated or not. */
export interface EmployeeSkillRating {
  skill: Skill;
  rating: number | null;
  notes: string | null;
  updated_at: string | null;
  /** The employee is under this skill's minimum age. */
  restricted: boolean;
  /** Restricted AND rated: the case the alert is about. */
  alert: boolean;
}

export interface EmployeeSkills {
  employee: SkillsEmployee;
  skills: EmployeeSkillRating[];
}

export interface SkillsOverviewEmployee extends SkillsEmployee {
  /** Their stores among the ones asked for: where they may be rated from. */
  store_numbers: string[];
  /** Keyed by skill id; unrated skills are absent. */
  ratings: Record<string, { rating: number; notes: string | null }>;
  /** Skills they are under the minimum age for, rated or not. */
  restricted_skill_ids: string[];
  /** Restricted AND rated. */
  alert_skill_ids: string[];
}

export interface StoreSkillsOverview {
  skills: Skill[];
  employees: SkillsOverviewEmployee[];
}
