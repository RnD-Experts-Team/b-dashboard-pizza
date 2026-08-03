import type { LaborDashboardResponse } from "@/types/labor.types";

/**
 * Cross-section badges shown on roster rows. Every one is derived by matching
 * `employee_id` against another section of the same response, so the roster
 * inherits context (new hire, veteran, overtime, departed) without any extra
 * request or per-row lookup.
 */
export type EmployeeBadge = "New" | "Veteran" | "Overtime" | "60h+" | "Departed";

/** Neutral badge — used for every marker except the 60h+ overtime flag. */
const NEUTRAL_BADGE =
  "border-border bg-muted text-muted-foreground hover:bg-muted/80";

export const BADGE_STYLES: Record<EmployeeBadge, string> = {
  New: NEUTRAL_BADGE,
  Veteran: NEUTRAL_BADGE,
  Overtime: NEUTRAL_BADGE,
  "60h+":
    "border-rose-500/40 bg-rose-500/15 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300",
  Departed: NEUTRAL_BADGE,
};

/** Built once per response in the orchestrator, not per rendered row. */
export function buildEmployeeBadges(
  data: LaborDashboardResponse,
): Map<number, EmployeeBadge[]> {
  const map = new Map<number, EmployeeBadge[]>();

  const add = (id: number, badge: EmployeeBadge) => {
    const existing = map.get(id);
    if (existing) {
      if (!existing.includes(badge)) existing.push(badge);
    } else {
      map.set(id, [badge]);
    }
  };

  data.tenure.newest_hires.forEach((e) => add(e.employee_id, "New"));
  data.tenure.longest_tenured.forEach((e) => add(e.employee_id, "Veteran"));
  data.overtime.over_40_hours.forEach((e) => add(e.employee_id, "Overtime"));
  data.overtime.over_60_hours.forEach((e) => add(e.employee_id, "60h+"));
  data.turnover.events.forEach((e) => add(e.employee_id, "Departed"));

  return map;
}
