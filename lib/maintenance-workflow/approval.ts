/**
 * Which approval level an amount needs (MAINTENANCE-V2 §2 "Approval levels").
 *
 * `maintenance_settings.approval_levels` lists levels with an EXCLUSIVE upper
 * bound `max` in dollars; the last one has `max: null` (no limit). The
 * server's `workflow.approval_level_for` answers this for the latest
 * estimate; the "Ask for approval" dialog uses this to say the level live as
 * the amount is typed, and falls back to the server's answer when the
 * settings could not be read.
 */

import { parseDecimal } from "@/lib/maintenance/money";
import type { ApprovalLevel } from "@/types/maintenance-v2";

/** The contract's default, used only when the settings are not readable. */
const SPECIALIST_MAX_DOLLARS = 300;
const MANAGER_MAX_DOLLARS = 1000;

export const DEFAULT_APPROVAL_LEVELS: readonly ApprovalLevel[] = [
  { max: SPECIALIST_MAX_DOLLARS, level: "specialist", label: "Maintenance Specialist" },
  { max: MANAGER_MAX_DOLLARS, level: "manager", label: "Maintenance Manager" },
  { max: null, level: "management", label: "Management" },
];

function maxOf(level: ApprovalLevel): number {
  const n = parseDecimal(level.max);
  return n == null ? Number.POSITIVE_INFINITY : n;
}

/** The level for an amount; null for no amount (or a negative one). */
export function approvalLevelOf(
  amount: string | number | null | undefined,
  levels: readonly ApprovalLevel[] | null | undefined,
): ApprovalLevel | null {
  const n = parseDecimal(amount);
  if (n == null || n < 0) return null;
  const sorted = [...(levels?.length ? levels : DEFAULT_APPROVAL_LEVELS)].sort((a, b) => maxOf(a) - maxOf(b));
  return sorted.find((level) => n < maxOf(level)) ?? sorted[sorted.length - 1] ?? null;
}
