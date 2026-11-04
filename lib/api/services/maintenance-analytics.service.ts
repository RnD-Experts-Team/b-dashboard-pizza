/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance — analytics: finances and coverage (MAINTENANCE §6)    */
/*                                                                            */
/*  summary / activity / watchlist keep their hand-mapped readers in         */
/*  maintenance-tickets.service.ts (used by the Overview tab today); this    */
/*  service adds the two new sections. Internal route: analytics/[section]. */
/* ────────────────────────────────────────────────────────────────────────── */

import { http, REPORT_TIMEOUT_MS } from "@/lib/api/maintenance-system/http";
import type {
  CoverageParams,
  FinancesParams,
  MaintenanceCoverage,
  MaintenanceFinances,
} from "@/types/maintenance-system";

export const maintenanceAnalyticsService = {
  /** `from`/`to` required, at most 400 days apart; mistaken payments excluded. */
  getFinances(params: FinancesParams, signal?: AbortSignal): Promise<MaintenanceFinances> {
    return http.get<MaintenanceFinances>("/analytics/finances", { query: params, signal, timeout: REPORT_TIMEOUT_MS });
  },
  /** Store × issue grid: how many technicians cover each pair (gap when ≤ 1). */
  getCoverage(params: CoverageParams = {}, signal?: AbortSignal): Promise<MaintenanceCoverage> {
    return http.get<MaintenanceCoverage>("/analytics/coverage", { query: params, signal, timeout: REPORT_TIMEOUT_MS });
  },
};
