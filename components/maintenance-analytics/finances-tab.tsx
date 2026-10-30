"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ApexOptions } from "apexcharts";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BadgeCheck,
  Boxes,
  ClipboardList,
  Clock,
  HardHat,
  Package,
  Repeat,
  Scale,
  Store as StoreIcon,
  Tags,
  Ticket,
  Truck,
  Warehouse,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useMaintenanceFinances } from "@/lib/hooks/use-maintenance-analytics";
import { decimalOr0, formatMinutes, formatMoney, parseDecimal } from "@/lib/maintenance/money";
import { formatDateOnly } from "@/lib/utils/date-display";
import type { FinancesParams, MaintenanceFinances } from "@/types/maintenance-v2";
import { AnalyticsCard } from "@/components/maintenance-tickets/analytics/analytics-card";
import { KpiTile } from "@/components/maintenance-tickets/analytics/analytics-kpis";
import { ChartCard, ChartEmpty, DataTable, FINANCE, PEOPLE, ReactApexChart, TD, TH, useChartInk } from "./chart-kit";
import { RankedBars, TOP_BARS, type RankedRow } from "./ranked-bars";
import { SpendTrendChart } from "./spend-trend-chart";
import type { AnalyticsFilters } from "./use-analytics-filters";

/** The longest range the report accepts (FinanceAnalyticsService::MAX_RANGE_DAYS). */
const MAX_RANGE_DAYS = 400;
const MS_PER_DAY = 86_400_000;
const KPI_SKELETONS = 5;
const ESTIMATE_CHART_HEIGHT_PX = 320;
const LABEL_MAX_PX = 160;
/** Estimate, actual and difference: the money columns of the estimate table. */
const MONEY_COLUMNS = [1, 2, 3];

const FINANCE_TINT = "bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400";
const PEOPLE_TINT = "bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400";

/** Inclusive day count of a "YYYY-MM-DD" range. */
function daysIn(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY) + 1;
}

function ticketHref(locale: string, ticketId: number, store: string | null): string {
  return `/${locale}/dashboard/maintenance-tickets/${ticketId}${store ? `?store=${encodeURIComponent(store)}` : ""}`;
}

/**
 * Finances (docs/MAINTENANCE-V2-UI.md §8 + MAINTENANCE-V2 §6): where the
 * money went in the range — KPI tiles, the spend trend by type, by store /
 * technician / supplier / category, stock money, and what tickets cost.
 * Mistaken payments are left out by the server.
 */
export function FinancesTab({ locale, filters }: { locale: string; filters: AnalyticsFilters }) {
  const t = useTranslations("maintenanceV2");
  const tooLong = daysIn(filters.from, filters.to) > MAX_RANGE_DAYS;

  const params: FinancesParams | null = useMemo(
    () =>
      tooLong
        ? null
        : {
            from: filters.from,
            to: filters.to,
            stores: filters.stores.length ? filters.stores : undefined,
            categoryId: filters.categoryId ?? undefined,
          },
    [filters.from, filters.to, filters.stores, filters.categoryId, tooLong],
  );
  const { finances, isLoading, isRefreshing, error, refresh } = useMaintenanceFinances(params);

  if (tooLong) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="max-w-sm text-sm text-muted-foreground">{t("analytics.rangeTooLong", { days: MAX_RANGE_DAYS })}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label={t("analytics.loading")}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: KPI_SKELETONS }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !finances) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
        <p className="max-w-sm text-sm text-muted-foreground">{error?.message ?? t("common.loadError")}</p>
        <Button variant="outline" onClick={() => void refresh()}>{t("common.retry")}</Button>
      </div>
    );
  }

  return (
    <div className={cn("@container space-y-6 transition-opacity duration-200", isRefreshing && "opacity-60")}>
      <FinanceKpis finances={finances} />
      <SpendTrendChart trend={finances.trend} trendBy={finances.range?.trendBy ?? "week"} />
      <WhereItWent finances={finances} />
      <StockMoney finances={finances} />
      <TicketCosts locale={locale} finances={finances} />
    </div>
  );
}

/* ── KPI tiles ───────────────────────────────────────────────────────────── */

function FinanceKpis({ finances }: { finances: MaintenanceFinances }) {
  const t = useTranslations("maintenanceV2");
  const { totals, unpaid, stock, range } = finances;
  const change = parseDecimal(totals.changePct);
  const previousRange = range ? `${formatDateOnly(range.previousFrom, "MMM d")} – ${formatDateOnly(range.previousTo, "MMM d")}` : "";
  const changeText = change == null ? "—" : `${change > 0 ? "+" : ""}${change}%`;

  return (
    <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-3 @5xl:grid-cols-5">
      <KpiTile kpi={{ label: t("analytics.spent"), value: formatMoney(totals.spent), icon: Banknote, tint: FINANCE_TINT, note: t("analytics.linesCount", { count: totals.lines }) }} />
      <KpiTile
        kpi={{
          label: t("analytics.vsPrevious"),
          value: changeText,
          icon: change != null && change < 0 ? ArrowDownRight : ArrowUpRight,
          tint: FINANCE_TINT,
          note: change == null ? t("analytics.nothingBefore") : t("analytics.previousWas", { amount: formatMoney(totals.previousSpent), range: previousRange }),
        }}
      />
      <KpiTile kpi={{ label: t("analytics.payments"), value: totals.payments, icon: ClipboardList, tint: FINANCE_TINT, note: t("analytics.paymentsNote") }} />
      <KpiTile
        kpi={{
          label: t("vocab.terms.unpaidWork.label"),
          value: formatMinutes(unpaid.paidMinutes),
          icon: Clock,
          tint: PEOPLE_TINT,
          note: t("analytics.unpaidNote", { sessions: unpaid.sessions, purchases: unpaid.purchases, amount: formatMoney(unpaid.purchasesTotal) }),
        }}
      />
      <KpiTile kpi={{ label: t("analytics.stockValue"), value: formatMoney(stock.onHandValue), icon: Warehouse, tint: PEOPLE_TINT, note: t("analytics.stockValueNote") }} />
    </div>
  );
}

/* ── By store / technician / supplier / category ─────────────────────────── */

function WhereItWent({ finances }: { finances: MaintenanceFinances }) {
  const t = useTranslations("maintenanceV2");
  const spent = t("analytics.spent");

  const storeLabel = (store: string | null, other?: string | null) => {
    if (store === "storage") return t("analytics.intoStorage");
    if (store === "other" || store == null) return other ?? t("common.otherStore");
    return store;
  };

  const byStore: RankedRow[] = finances.byStore.map((r) => ({ key: `${r.storeNumber}:${r.other ?? ""}`, label: storeLabel(r.storeNumber, r.other), value: decimalOr0(r.amount) }));
  const byTechnician: RankedRow[] = finances.byTechnician.map((r) => ({ key: String(r.id), label: r.name, value: decimalOr0(r.amount) }));
  const bySupplier: RankedRow[] = finances.bySupplier.map((r) => ({ key: String(r.id), label: r.name, value: decimalOr0(r.amount) }));
  const byCategory: RankedRow[] = finances.byCategory.map((r) => ({ key: String(r.id ?? "none"), label: r.id == null ? t("technicians.noCategory") : r.name, value: decimalOr0(r.amount) }));

  return (
    <div className="grid gap-6 @4xl:grid-cols-2">
      <RankedBars icon={StoreIcon} title={t("analytics.byStore")} description={t("analytics.byStoreHelp")} rows={byStore} color={FINANCE[0]} valueHead={spent} />
      <RankedBars icon={HardHat} title={t("analytics.byTechnician")} description={t("analytics.topHelp", { count: TOP_BARS })} rows={byTechnician} color={PEOPLE[0]} valueHead={spent} />
      <RankedBars icon={Truck} title={t("analytics.bySupplier")} description={t("analytics.topHelp", { count: TOP_BARS })} rows={bySupplier} color={PEOPLE[1]} valueHead={spent} />
      <RankedBars icon={Tags} title={t("analytics.byCategory")} description={t("analytics.byCategoryHelp")} rows={byCategory} color={FINANCE[1]} valueHead={spent} />
    </div>
  );
}

/* ── Stock money ─────────────────────────────────────────────────────────── */

function StockMoney({ finances }: { finances: MaintenanceFinances }) {
  const t = useTranslations("maintenanceV2");
  const s = finances.stock;
  const rows: RankedRow[] = [
    { key: "bought", label: t("vocab.movementType.bought.label"), value: decimalOr0(s.boughtValue) },
    { key: "used", label: t("vocab.movementType.used.label"), value: decimalOr0(s.usedValue) },
    { key: "losses", label: t("analytics.countLosses"), value: decimalOr0(s.countLosses) },
    { key: "gains", label: t("analytics.countGains"), value: decimalOr0(s.countGains) },
    { key: "damaged", label: t("vocab.movementType.damaged_lost.label"), value: decimalOr0(s.damagedLostValue) },
  ];
  return (
    <div className="grid gap-6 @4xl:grid-cols-2">
      <RankedBars
        icon={Boxes}
        title={t("analytics.stockMoney")}
        description={t("analytics.stockMoneyHelp")}
        rows={rows}
        color={PEOPLE[0]}
        valueHead={t("common.amount")}
        sorted={false}
      />
      <ApprovalsByLevel finances={finances} />
    </div>
  );
}

function ApprovalsByLevel({ finances }: { finances: MaintenanceFinances }) {
  const t = useTranslations("maintenanceV2");
  const rows = finances.tickets.approvalsByLevel;
  return (
    <AnalyticsCard icon={BadgeCheck} title={t("analytics.approvalsByLevel")} description={t("analytics.approvalsByLevelHelp")} flush>
      {rows.length === 0 ? (
        <ChartEmpty>{t("analytics.nothingInRange")}</ChartEmpty>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th scope="col" className={TH}>{t("analytics.level")}</th>
              <th scope="col" className={`${TH} text-end`}>{t("analytics.approvals")}</th>
              <th scope="col" className={`${TH} text-end`}>{t("common.amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.level}>
                <td className={TD}>{r.label}</td>
                <td className={`${TD} text-end tabular-nums`}>{r.count}</td>
                <td className={`${TD} text-end tabular-nums`}>{formatMoney(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AnalyticsCard>
  );
}

/* ── Ticket costs ────────────────────────────────────────────────────────── */

function TicketCosts({ locale, finances }: { locale: string; finances: MaintenanceFinances }) {
  const t = useTranslations("maintenanceV2");
  const tk = finances.tickets;
  const byIssue: RankedRow[] = tk.byIssue.map((r) => ({ key: String(r.issueId ?? "other"), label: r.title, value: decimalOr0(r.amount) }));

  return (
    <section aria-labelledby="ticket-costs" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="ticket-costs" className="font-heading text-lg font-semibold">{t("analytics.ticketCosts")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("analytics.avgPerTicket")}: <span className="font-semibold tabular-nums text-foreground">{formatMoney(tk.costPerTicketAvg)}</span>
        </p>
      </div>
      <div className="grid gap-6 @4xl:grid-cols-2">
        <AnalyticsCard icon={Ticket} title={t("analytics.topTickets")} description={t("analytics.topTicketsHelp")} flush>
          {tk.topTickets.length === 0 ? (
            <ChartEmpty>{t("analytics.nothingInRange")}</ChartEmpty>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th scope="col" className={TH}>{t("pages.ticket")}</th>
                  <th scope="col" className={TH}>{t("common.store")}</th>
                  <th scope="col" className={`${TH} text-end`}>{t("analytics.spent")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tk.topTickets.map((r) => (
                  <tr key={r.ticketId}>
                    <td className={TD}>
                      <Link href={ticketHref(locale, r.ticketId, r.storeNumber)} className="font-medium text-primary hover:underline">
                        #{r.ticketId}
                      </Link>{" "}
                      <span className="text-muted-foreground">{r.title}</span>
                    </td>
                    <td className={`${TD} tabular-nums`}>{r.storeNumber ?? "—"}</td>
                    <td className={`${TD} text-end font-medium tabular-nums`}>{formatMoney(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AnalyticsCard>
        <RankedBars icon={Package} title={t("analytics.byIssue")} description={t("analytics.byIssueHelp")} rows={byIssue} color={FINANCE[0]} valueHead={t("analytics.spent")} />
        <EstimateVsActual finances={finances} />
        <AnalyticsCard icon={Repeat} title={t("analytics.recurringCostly")} description={t("analytics.recurringCostlyHelp")} flush>
          {tk.recurringCostly.length === 0 ? (
            <ChartEmpty>{t("analytics.noRecurring")}</ChartEmpty>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th scope="col" className={TH}>{t("common.store")}</th>
                  <th scope="col" className={TH}>{t("analytics.issue")}</th>
                  <th scope="col" className={`${TH} text-end`}>{t("pages.tickets")}</th>
                  <th scope="col" className={`${TH} text-end`}>{t("analytics.spent")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tk.recurringCostly.map((r) => (
                  <tr key={`${r.storeNumber}:${r.issueId}`}>
                    <td className={`${TD} tabular-nums`}>{r.storeNumber ?? "—"}</td>
                    <td className={TD}>{r.title}</td>
                    <td className={`${TD} text-end tabular-nums`}>{r.tickets}</td>
                    <td className={`${TD} text-end font-medium tabular-nums`}>{formatMoney(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AnalyticsCard>
      </div>
    </section>
  );
}

/** Estimate vs actual for the issues that cost most: two bars per issue, the top ten drawn. */
function EstimateVsActual({ finances }: { finances: MaintenanceFinances }) {
  const t = useTranslations("maintenanceV2");
  const ink = useChartInk();
  const rows = finances.tickets.estimateVsActual;
  const top = useMemo(() => rows.slice(0, TOP_BARS), [rows]);

  const options: ApexOptions = useMemo(
    () => ({
      chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit", foreColor: ink.fore, animations: { enabled: false } },
      colors: [PEOPLE[1], FINANCE[0]],
      plotOptions: { bar: { horizontal: true, barHeight: "70%" } },
      dataLabels: { enabled: false },
      xaxis: { categories: top.map((r) => r.title), labels: { formatter: (v: string) => formatMoney(Number(v)) } },
      yaxis: { labels: { maxWidth: LABEL_MAX_PX } },
      grid: { borderColor: ink.grid },
      legend: { position: "bottom" },
      tooltip: { theme: ink.tooltip, shared: true, intersect: false, y: { formatter: (v: number) => formatMoney(v) } },
    }),
    [top, ink],
  );

  const series = [
    { name: t("costs.estimated"), data: top.map((r) => decimalOr0(r.estimated)) },
    { name: t("analytics.actual"), data: top.map((r) => decimalOr0(r.actual)) },
  ];

  return (
    <ChartCard
      icon={Scale}
      title={t("analytics.estimateVsActual")}
      description={t("analytics.estimateVsActualHelp")}
      chart={() =>
        top.length === 0 ? (
          <ChartEmpty>{t("analytics.nothingInRange")}</ChartEmpty>
        ) : (
          <figure>
            <figcaption className="sr-only">{t("analytics.estimateVsActual")}</figcaption>
            <ReactApexChart type="bar" series={series} options={options} height={ESTIMATE_CHART_HEIGHT_PX} />
          </figure>
        )
      }
      table={() => (
        <DataTable
          head={[t("analytics.issue"), t("costs.estimated"), t("analytics.actual"), t("analytics.difference")]}
          rows={rows.map((r) => {
            const diff = decimalOr0(r.actual) - decimalOr0(r.estimated);
            return [r.title, formatMoney(r.estimated), formatMoney(r.actual), `${diff > 0 ? "+" : ""}${formatMoney(diff)}`];
          })}
          numeric={MONEY_COLUMNS}
        />
      )}
    />
  );
}
