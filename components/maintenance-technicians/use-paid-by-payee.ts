"use client";

import { useMemo } from "react";
import { useMaintenanceFinances } from "@/lib/hooks/use-maintenance-analytics";
import { presetDays } from "@/lib/maintenance-tickets/local-range";
import type { FinancesParams, Money } from "@/types/maintenance-v2";

/**
 * What each technician and each supplier was paid over a range of days, read
 * from the Finances report (mistaken payments left out) — the technician and
 * supplier lists carry no money of their own. One request covers both lists.
 *
 * `null` maps while loading or when the report is refused: the columns then
 * show "—" rather than a wrong $0.
 */
export function usePaidByPayee(range: "thisMonth" | "thisYear", enabled = true) {
  const params: FinancesParams | null = useMemo(() => {
    if (!enabled) return null;
    const { startDate, endDate } = presetDays(range);
    return { from: startDate, to: endDate };
  }, [range, enabled]);

  const { finances, isLoading, error } = useMaintenanceFinances(params);

  const byTechnician = useMemo(
    () => (finances ? new Map<number, Money>(finances.byTechnician.map((r) => [r.id, r.amount])) : null),
    [finances],
  );
  const bySupplier = useMemo(
    () => (finances ? new Map<number, Money>(finances.bySupplier.map((r) => [r.id, r.amount])) : null),
    [finances],
  );

  return { byTechnician, bySupplier, isLoading, error };
}
