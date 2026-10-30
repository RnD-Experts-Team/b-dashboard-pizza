/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance v2 — analytics: finances and coverage (MAINTENANCE-V2 §6)    */
/*  Summary / activity / watchlist keep types/maintenance-analytics.types.ts. */
/* ────────────────────────────────────────────────────────────────────────── */

import type { IdName, IsoDate, Money } from "./common.types";
import type { PaymentLineType } from "./payments.types";
import type { ApprovalLevelKey } from "./workflow.types";

/**
 * How the trend is bucketed. The SERVER picks it (FinanceAnalyticsService:
 * ISO weeks when the range is 92 days or less, months beyond) and says which
 * in `range.trendBy`; there is no parameter to choose it.
 */
export type FinanceTrendGroup = "month" | "week";

export interface FinancesParams {
  /** Required; at most 400 days apart. */
  from: IsoDate;
  to: IsoDate;
  stores?: string[];
  categoryId?: number;
  technicianId?: number;
  supplierId?: number;
}

export interface FinancesTotals {
  spent: Money;
  previousSpent: Money;
  /** null when the previous period spent nothing. */
  changePct: number | string | null;
  payments: number;
  lines: number;
}

export interface FinancesTrendPoint {
  /** YYYY-MM, or the ISO week's start date. */
  period: string;
  amount: Money;
  byType: Partial<Record<PaymentLineType, Money>>;
}

export interface FinancesRange {
  from: IsoDate;
  to: IsoDate;
  /** The period of the same length just before, which `previousSpent` covers. */
  previousFrom: IsoDate;
  previousTo: IsoDate;
  /** The trend's buckets, chosen by the server from the range's length. */
  trendBy: FinanceTrendGroup;
}

export interface MaintenanceFinances {
  /** Sent by the server (FinanceAnalyticsService::report); absent on older builds. */
  range?: FinancesRange;
  totals: FinancesTotals;
  byType: { type: PaymentLineType; label: string; amount: Money }[];
  trend: FinancesTrendPoint[];
  /**
   * A store number, or the literal "storage" (parts bought for the shelf) or
   * "other" (a store outside the list), so the rows add up to `spent`.
   */
  byStore: { storeNumber: string | null; other?: string | null; amount: Money }[];
  /** `category` is `{id, name}` on the wire (a bare string on older builds). */
  byTechnician: { id: number; name: string; category: IdName | string | null; amount: Money }[];
  bySupplier: { id: number; name: string; amount: Money }[];
  byCategory: { id: number | null; name: string; amount: Money }[];
  stock: {
    onHandValue: Money;
    boughtValue: Money;
    usedValue: Money;
    countLosses: Money;
    countGains: Money;
    damagedLostValue: Money;
  };
  tickets: {
    costPerTicketAvg: Money | null;
    topTickets: { ticketId: number; storeNumber: string | null; title: string; amount: Money }[];
    byIssue: { issueId: number | null; title: string; amount: Money; tickets: number }[];
    estimateVsActual: { ticketIssueId: number; title: string; estimated: Money | null; actual: Money }[];
    approvalsByLevel: { level: ApprovalLevelKey; label: string; count: number; amount: Money }[];
    recurringCostly: { storeNumber: string | null; issueId: number | null; title: string; tickets: number; amount: Money }[];
  };
  unpaid: {
    sessions: number;
    paidMinutes: number;
    purchases: number;
    purchasesTotal: Money;
  };
}

export interface CoverageParams {
  stores?: string[];
  issueIds?: number[];
  categoryId?: number;
}

export interface CoverageCell {
  storeNumber: string;
  issueId: number;
  title: string;
  /** How many technicians cover this store AND this issue. */
  technicians: number;
  emergency: number;
  averageRating: string | null;
  /** technicians <= 1 */
  gap: boolean;
}

export interface MaintenanceCoverage {
  kpis: {
    techniciansForStores: number;
    techniciansForIssues: number;
    techniciansForBoth: number;
    emergencyAvailable: number;
  };
  cells: CoverageCell[];
  /** Count of gap cells. */
  gaps: number;
}
