/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance v2 — settings: approval levels, trip link idle hours (§2)    */
/*  Internal route: maintenance-settings.                                    */
/* ────────────────────────────────────────────────────────────────────────── */

import { http } from "@/lib/api/maintenance-v2/http";
import type { MaintenanceSettings, MaintenanceSettingsInput } from "@/types/maintenance-v2";

export const maintenanceSettingsService = {
  getSettings(signal?: AbortSignal): Promise<MaintenanceSettings> {
    return http.get<MaintenanceSettings>("/maintenance-settings", { signal });
  },
  /** Only the keys sent change. */
  updateSettings(input: MaintenanceSettingsInput): Promise<MaintenanceSettings> {
    return http.put<MaintenanceSettings>("/maintenance-settings", input);
  },
};
