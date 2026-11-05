"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Toggle, V1_NUM, V1_TBL, V1_TD, V1_TH } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportTab } from "@/components/business-reports/report-dialog";
import { useSection } from "@/components/business-reports/report-context";
import { compareText, fmtNum, fmtPct, fmtRange } from "@/components/business-reports/report-format";
import type {
  HnrTotals,
  OperationsMetrics,
  OperationsSection,
  OrdersSection,
  ReportWeek,
} from "@/types/business-reports.types";
import {
  DialogNote,
  NO_VALUE,
  PpDelta,
  TrendChart,
  meanOf,
  plural,
  storeSearch,
  useStoreFocus,
  useStoreRows,
  useWeekLabel,
} from "./br-shared";
import { HNR_SCOPE_OPTIONS, ScopeBar, hnrSource, type HnrScope } from "./br-hnr";

const [PORTAL_COLOR, HNR_COLOR] = CATEGORIES.operations.chartColors;
const fmtAxisPct = (v: number): string => `${v.toFixed(0)}%`;

interface WeekRow {
  week: ReportWeek & OperationsMetrics;
  hnr: HnrTotals | null;
  /** The previous week in the range (chronologically), for the Δ columns. */
  prevPortal: number | null;
  prevHnr: number | null;
}

/** Weeks latest first, each carrying the HnR figures for the scope and its previous week's values. */
function buildRows(ops: OperationsSection, orders: OrdersSection | null, scope: HnrScope): WeekRow[] {
  const special = new Map((orders?.important_items_hnr.by_week ?? []).map((w) => [w.week_start, w]));
  const hnrOf = (w: ReportWeek & OperationsMetrics): HnrTotals | null =>
    scope === "special" ? (special.get(w.week_start) ?? null) : w;
  const chronological = [...ops.by_week].sort((a, b) => compareText(a.week_start, b.week_start));
  return chronological
    .map((week, i) => {
      const prev = i > 0 ? chronological[i - 1] : undefined;
      return {
        week,
        hnr: hnrOf(week),
        prevPortal: prev ? prev.in_portal_on_time_percent : null,
        prevHnr: prev ? (hnrOf(prev)?.hnr_promise_met_percent ?? null) : null,
      };
    })
    .reverse();
}

function Dash() {
  return <span className="text-muted-foreground">{NO_VALUE}</span>;
}

const hnrCell = (r: WeekRow, read: (h: HnrTotals) => number, format: (n: number) => string) =>
  r.hnr ? format(read(r.hnr)) : <Dash />;

/** Every column after the week, shared by the dialog's By week table. */
const VALUE_COLUMNS: PagedColumn<WeekRow>[] = [
  { key: "portal", header: "Portal %", numeric: true, sortValue: (r) => r.week.in_portal_on_time_percent, render: (r) => fmtPct(r.week.in_portal_on_time_percent) },
  { key: "portal_d", header: "Δ Portal", numeric: true, render: (r) => <PpDelta curr={r.week.in_portal_on_time_percent} prev={r.prevPortal} /> },
  { key: "eligible", header: "Eligible", numeric: true, sortValue: (r) => r.week.portal_eligible_orders, render: (r) => fmtNum(r.week.portal_eligible_orders) },
  { key: "used", header: "Used", numeric: true, sortValue: (r) => r.week.portal_used_orders, render: (r) => fmtNum(r.week.portal_used_orders) },
  { key: "ontime", header: "On-Time", numeric: true, sortValue: (r) => r.week.portal_on_time_orders, render: (r) => fmtNum(r.week.portal_on_time_orders) },
  { key: "hnr", header: "HNR %", numeric: true, sortValue: (r) => r.hnr?.hnr_promise_met_percent, render: (r) => hnrCell(r, (h) => h.hnr_promise_met_percent, fmtPct) },
  {
    key: "hnr_d",
    header: "Δ HNR",
    numeric: true,
    render: (r) => (r.hnr ? <PpDelta curr={r.hnr.hnr_promise_met_percent} prev={r.prevHnr} /> : <Dash />),
  },
  { key: "trans", header: "HNR Txns", numeric: true, sortValue: (r) => r.hnr?.hnr_transactions, render: (r) => hnrCell(r, (h) => h.hnr_transactions, fmtNum) },
  { key: "met", header: "Met", numeric: true, sortValue: (r) => r.hnr?.hnr_promise_met, render: (r) => hnrCell(r, (h) => h.hnr_promise_met, fmtNum) },
  { key: "broken", header: "Broken", numeric: true, sortValue: (r) => r.hnr?.hnr_broken_promises, render: (r) => hnrCell(r, (h) => h.hnr_broken_promises, fmtNum) },
];

interface StoreWeeklyRow {
  store: string;
  name: string;
  portal: number;
  hnr: number | null;
  eligible: number;
  trans: number | null;
}

const STORE_COLUMNS: PagedColumn<StoreWeeklyRow>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  { key: "portal", header: "Portal %", numeric: true, sortValue: (r) => r.portal, render: (r) => fmtPct(r.portal) },
  { key: "eligible", header: "Eligible", numeric: true, sortValue: (r) => r.eligible, render: (r) => fmtNum(r.eligible) },
  { key: "hnr", header: "HNR %", numeric: true, sortValue: (r) => r.hnr, render: (r) => (r.hnr === null ? <Dash /> : fmtPct(r.hnr)) },
  { key: "trans", header: "HNR Txns", numeric: true, sortValue: (r) => r.trans, render: (r) => (r.trans === null ? <Dash /> : fmtNum(r.trans)) },
];

function WeeklyDialog({ ops, orders, onClose }: { ops: OperationsSection; orders: OrdersSection | null; onClose: () => void }) {
  const [scope, setScope] = useState<HnrScope>("all");
  const rows = useMemo(() => buildRows(ops, orders, scope), [ops, orders, scope]);
  const labelOf = useWeekLabel(ops.by_week);
  const chronological = useMemo(() => [...rows].reverse(), [rows]);
  const categories = useMemo(() => chronological.map((r) => labelOf(r.week.week_start)), [chronological, labelOf]);
  const series = useMemo(
    () => [
      { name: "Portal %", data: chronological.map((r) => Number(r.week.in_portal_on_time_percent.toFixed(1))), color: PORTAL_COLOR },
      { name: "HNR %", data: chronological.map((r) => (r.hnr ? Number(r.hnr.hnr_promise_met_percent.toFixed(1)) : null)), color: HNR_COLOR },
    ],
    [chronological],
  );
  const columns = useMemo<PagedColumn<WeekRow>[]>(
    () => [{ key: "week", header: "Week", sortValue: (r) => r.week.week_start, render: (r) => labelOf(r.week.week_start) }, ...VALUE_COLUMNS],
    [labelOf],
  );
  const hnrStores = hnrSource(scope, ops, orders).byStore;
  const opsStores = useStoreRows(ops.by_store);
  const stores = useMemo<StoreWeeklyRow[]>(
    () =>
      opsStores.map((r) => {
        const h = hnrStores[r.store];
        return {
          store: r.store,
          name: r.name,
          portal: r.data.in_portal_on_time_percent,
          eligible: r.data.portal_eligible_orders,
          hnr: h ? h.hnr_promise_met_percent : null,
          trans: h ? h.hnr_transactions : null,
        };
      }),
    [opsStores, hnrStores],
  );
  const focus = useStoreFocus<StoreWeeklyRow>();
  const latest = rows[0];
  const avgPortal = meanOf(rows.map((r) => r.week.in_portal_on_time_percent));
  const avgHnr = meanOf(rows.map((r) => r.hnr?.hnr_promise_met_percent));
  const scopeNote = scope === "special" ? " (Special Items)" : "";
  const bar = (children: ReactNode) => (
    <ScopeBar scope={scope} onChange={setScope} hasSpecial={Boolean(orders)}>
      {children}
    </ScopeBar>
  );

  const tabs: ReportTab[] = [
    {
      key: "overview",
      label: "Overview",
      content: bar(
        <ReportBlock title="Portal % and HNR % by week" description={`Portal % = in-portal on time; HNR % = promise met${scopeNote}.`}>
          <TrendChart key={scope} categories={categories} series={series} format={fmtAxisPct} />
        </ReportBlock>,
      ),
    },
    {
      key: "weeks",
      label: "By week",
      content: bar(
        <div className="space-y-2">
          <PagedTable key={scope} size="lg" rows={rows} columns={columns} rowKey={(r) => r.week.week_start} initialSort="week" />
          <DialogNote>Δ compares each week to the previous week in the range.</DialogNote>
        </div>,
      ),
    },
    {
      key: "stores",
      label: "By store",
      content: bar(
        <PagedTable
          key={scope}
          size="lg"
          rows={stores}
          columns={STORE_COLUMNS}
          rowKey={(r) => r.store}
          initialSort="portal"
          searchText={storeSearch}
          onRowClick={focus.onRowClick}
          footerNote={focus.footerNote}
        />,
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Portal & HNR — Weekly"
      category="operations"
      stats={[
        { label: "Weeks", value: fmtNum(rows.length) },
        {
          label: "Latest Portal %",
          value: latest ? fmtPct(latest.week.in_portal_on_time_percent) : NO_VALUE,
          sub: latest ? labelOf(latest.week.week_start) : undefined,
        },
        {
          label: "Latest HNR %",
          value: latest?.hnr ? fmtPct(latest.hnr.hnr_promise_met_percent) : NO_VALUE,
          sub: latest ? `${labelOf(latest.week.week_start)}${scopeNote}` : undefined,
        },
        { label: "Avg Portal %", value: avgPortal === null ? NO_VALUE : fmtPct(avgPortal), sub: "mean of weeks" },
        { label: "Avg HNR %", value: avgHnr === null ? NO_VALUE : fmtPct(avgHnr), sub: `mean of weeks${scopeNote}` },
      ]}
      tabs={tabs}
    />
  );
}

/** Week-over-week Portal % and HNR % inside the loaded range, latest week first. */
export function BrPortalWeeklyCard({ data }: { data: OperationsSection }) {
  const orders = useSection("orders").data;
  const [scope, setScope] = useState<HnrScope>("all");
  const [open, setOpen] = useState(false);
  const effectiveScope: HnrScope = orders ? scope : "all";
  const rows = useMemo(() => buildRows(data, orders, effectiveScope), [data, orders, effectiveScope]);
  const labelOf = useWeekLabel(data.by_week);
  const empty = rows.length === 0;

  return (
    <V1Card
      reportId="br-portal-weekly"
      title="Portal & HNR Weekly"
      category="operations"
      period="R"
      span={2}
      headerNote={plural(rows.length, "wk")}
      bodyClassName="px-0"
      onExpand={empty ? undefined : () => setOpen(true)}
      headerControl={
        orders ? <V1Toggle className="ms-1" options={HNR_SCOPE_OPTIONS} value={scope} onChange={setScope} /> : undefined
      }
    >
      {empty ? (
        <V1Empty>No weeks in this range.</V1Empty>
      ) : (
        <table className={V1_TBL}>
          <thead>
            <tr>
              <th className={V1_TH}>Week</th>
              <th className={cn(V1_TH, V1_NUM)}>Portal %</th>
              <th className={cn(V1_TH, V1_NUM)}>HNR %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.week.week_start}>
                <td className={cn(V1_TD, "whitespace-nowrap font-medium")} title={fmtRange(r.week.start, r.week.end)}>
                  {labelOf(r.week.week_start)}
                </td>
                <td className={cn(V1_TD, V1_NUM)}>
                  {fmtPct(r.week.in_portal_on_time_percent)}{" "}
                  <span className="text-[10px]">
                    <PpDelta curr={r.week.in_portal_on_time_percent} prev={r.prevPortal} />
                  </span>
                </td>
                <td className={cn(V1_TD, V1_NUM)}>
                  {r.hnr ? (
                    <>
                      {fmtPct(r.hnr.hnr_promise_met_percent)}{" "}
                      <span className="text-[10px]">
                        <PpDelta curr={r.hnr.hnr_promise_met_percent} prev={r.prevHnr} />
                      </span>
                    </>
                  ) : (
                    <Dash />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open && <WeeklyDialog ops={data} orders={orders} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
