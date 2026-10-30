"use client";

/** Maintenance settings: approval levels (who approves what amount) and trip link idle hours. */

import { maintenanceSettingsService } from "@/lib/api/services/maintenance-settings.service";
import { useMaintenanceMutation, useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import type { MaintenanceSettingsInput } from "@/types/maintenance-v2";

export function useMaintenanceSettings(enabled = true) {
  const res = useMaintenanceResource(enabled ? "maintenance-settings" : null, (signal) => maintenanceSettingsService.getSettings(signal));
  const save = useMaintenanceMutation(async (input: MaintenanceSettingsInput) => {
    const next = await maintenanceSettingsService.updateSettings(input);
    res.setData(next);
    return next;
  });
  return { ...res, settings: res.data, save };
}
