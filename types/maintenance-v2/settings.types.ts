/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance v2 — settings (GET/PUT maintenance-settings, §2)              */
/* ────────────────────────────────────────────────────────────────────────── */

import type { ApprovalLevelKey } from "./workflow.types";

/** `max` is an EXCLUSIVE upper bound in dollars; null = no limit (the last level). */
export interface ApprovalLevel {
  /** Sent back as a number or a decimal string. */
  max: number | string | null;
  level: ApprovalLevelKey;
  label: string;
}

export interface MaintenanceSettings {
  approvalLevels: ApprovalLevel[];
  /** How long a trip link keeps working after its last use. */
  tripLinkIdleHours: number;
}

export type MaintenanceSettingsInput = Partial<MaintenanceSettings>;
