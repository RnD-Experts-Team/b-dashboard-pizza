"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpeedometerGauge, type SpeedZone } from "@/components/dspr/speedometer-gauge";
import { getLaborLabel } from "@/components/dspr/portal-meter-utils";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1Toggle } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportTab } from "@/components/business-reports/report-dialog";
import { useSection } from "@/components/business-reports/report-context";
import { fmtNum, fmtPct } from "@/components/business-reports/report-format";
import type { HnrTotals, OperationsSection, OrdersSection, ReportWeek } from "@/types/business-reports.types";
import {
  Count,
  CountDelta,
  PERCENT,
  PpDelta,
  TrendChart,
  storeSearch,
  useStoreFocus,
  useStoreRows,
  useWeekLabel,
  withPrev,
  type StoreRow,
} from "./br-shared";

/* The V1 Hot-N-Ready meter zones. */
const HNR_RED_TO = 60;
const HNR_YELLOW_TO = 70;
const HNR_ORANGE_TO = 90;

export const HNR_ZONES: SpeedZone[] = [
  { from: 0, to: HNR_RED_TO, color: "#EF4444" },
  { from: HNR_RED_TO, to: HNR_YELLOW_TO, color: "#EAB308" },
  { from: HNR_YELLOW_TO, to: HNR_ORANGE_TO, color: "#F97316" },
  { from: HNR_ORANGE_TO, to: PERCENT, color: "#22C55E" },
];

export type HnrScope = "all" | "special";

export const HNR_SCOPE_OPTIONS: { value: HnrScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "special", label: "Special" },
];

const DIALOG_SCOPE_OPTIONS: { value: HnrScope; label: string }[] = [
  { value: "all", label: "All Items" },
  { value: "special", label: "Special Items" },
];

const MET_COLOR = CATEGORIES.operations.chartColors[0];
const fmtAxisPct = (v: number): string => `${v.toFixed(0)}%`;

interface HnrSource {
  totals: HnrTotals;
  byStore: Record<string, HnrTotals>;
  byWeek: Array<ReportWeek & HnrTotals>;
}

/** All = store-wide HnR (operations); Special = the important items (orders). */
export function hnrSource(scope: HnrScope, ops: OperationsSection, orders: OrdersSection | null): HnrSource {
  if (scope === "special" && orders) {
    const s = orders.important_items_hnr;
    return { totals: s.totals, byStore: s.by_store, byWeek: s.by_week };
  }
  return { totals: ops.totals, byStore: ops.by_store, byWeek: ops.by_week };
}

/** The dialog's All / Special switch, shown above each tab (Special once the orders section is in). */
export function ScopeBar({
  scope,
  onChange,
  hasSpecial,
  children,
}: {
  scope: HnrScope;
  onChange: (scope: HnrScope) => void;
  hasSpecial: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      {hasSpecial && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">Items</span>
          <V1Toggle className="text-xs [&_button]:px-2.5 [&_button]:py-1" options={DIALOG_SCOPE_OPTIONS} value={scope} onChange={onChange} />
        </div>
      )}
      {children}
    </div>
  );
}

type Week = ReportWeek & HnrTotals;
interface WeekRow {
  week: Week;
  prev: Week | null;
}

const STORE_COLUMNS: PagedColumn<StoreRow<HnrTotals>>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  { key: "met_pct", header: "Promise Met %", numeric: true, sortValue: (r) => r.data.hnr_promise_met_percent, render: (r) => fmtPct(r.data.hnr_promise_met_percent) },
  { key: "trans", header: "Transactions", numeric: true, sortValue: (r) => r.data.hnr_transactions, render: (r) => fmtNum(r.data.hnr_transactions) },
  { key: "kept", header: "Kept", numeric: true, sortValue: (r) => r.data.hnr_promise_met, render: (r) => fmtNum(r.data.hnr_promise_met) },
  {
    key: "broken",
    header: "Broken",
    numeric: true,
    sortValue: (r) => r.data.hnr_broken_promises,
    render: (r) => <span className={r.data.hnr_broken_promises > 0 ? "text-red-600 dark:text-red-400" : undefined}>{fmtNum(r.data.hnr_broken_promises)}</span>,
  },
];

function HnrDialog({ ops, orders, onClose }: { ops: OperationsSection; orders: OrdersSection | null; onClose: () => void }) {
  const [scope, setScope] = useState<HnrScope>("all");
  const source = hnrSource(scope, ops, orders);
  const stores = useStoreRows(source.byStore);
  const focus = useStoreFocus<StoreRow<HnrTotals>>();
  const labelOf = useWeekLabel(source.byWeek);
  const weeks = useMemo<WeekRow[]>(() => withPrev(source.byWeek).map(({ row, prev }) => ({ week: row, prev })), [source.byWeek]);
  const categories = useMemo(() => source.byWeek.map((w) => labelOf(w.week_start)), [source.byWeek, labelOf]);
  const series = useMemo(
    () => [{ name: "Promise met %", data: source.byWeek.map((w) => Number(w.hnr_promise_met_percent.toFixed(1))), color: MET_COLOR }],
    [source.byWeek],
  );
  const weekColumns = useMemo<PagedColumn<WeekRow>[]>(
    () => [
      { key: "week", header: "Week", sortValue: (r) => r.week.week_start, render: (r) => labelOf(r.week.week_start) },
      { key: "met_pct", header: "Promise Met %", numeric: true, sortValue: (r) => r.week.hnr_promise_met_percent, render: (r) => fmtPct(r.week.hnr_promise_met_percent) },
      { key: "met_d", header: "Δ vs prev. week", numeric: true, render: (r) => <PpDelta curr={r.week.hnr_promise_met_percent} prev={r.prev?.hnr_promise_met_percent} /> },
      { key: "trans", header: "Transactions", numeric: true, sortValue: (r) => r.week.hnr_transactions, render: (r) => fmtNum(r.week.hnr_transactions) },
      { key: "kept", header: "Kept", numeric: true, sortValue: (r) => r.week.hnr_promise_met, render: (r) => fmtNum(r.week.hnr_promise_met) },
      { key: "broken", header: "Broken", numeric: true, sortValue: (r) => r.week.hnr_broken_promises, render: (r) => fmtNum(r.week.hnr_broken_promises) },
      {
        key: "broken_d",
        header: "Δ Broken",
        numeric: true,
        render: (r) => <CountDelta curr={r.week.hnr_broken_promises} prev={r.prev?.hnr_broken_promises} goodWhen="down" />,
      },
    ],
    [labelOf],
  );
  const t = source.totals;
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
        <ReportBlock title="Promise met % by week" description={scope === "special" ? "Special items only." : "Every Hot-N-Ready item."}>
          <TrendChart key={scope} categories={categories} series={series} format={fmtAxisPct} />
        </ReportBlock>,
      ),
    },
    {
      key: "weeks",
      label: "By week",
      content: bar(<PagedTable key={scope} size="lg" rows={weeks} columns={weekColumns} rowKey={(r) => r.week.week_start} initialSort="week" />),
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
          initialSort="met_pct"
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
      title={scope === "special" ? "Hot-N-Ready · Special Items" : "Hot-N-Ready"}
      category="operations"
      stats={[
        { label: "Promise met", value: fmtPct(t.hnr_promise_met_percent), sub: getLaborLabel(t.hnr_promise_met_percent) },
        { label: "Transactions", value: fmtNum(t.hnr_transactions) },
        { label: "Kept", value: fmtNum(t.hnr_promise_met), tone: "text-emerald-600 dark:text-emerald-400" },
        { label: "Broken", value: fmtNum(t.hnr_broken_promises), tone: t.hnr_broken_promises > 0 ? "text-red-600 dark:text-red-400" : undefined },
      ]}
      tabs={tabs}
    />
  );
}

/**
 * Promise-met gauge. "All" renders from operations straight away; the
 * "Special" toggle appears once the orders section has landed.
 */
export function BrHnrCard({ data }: { data: OperationsSection }) {
  const orders = useSection("orders").data;
  const [scope, setScope] = useState<HnrScope>("all");
  const [open, setOpen] = useState(false);
  const active = hnrSource(scope, data, orders).totals;
  const pct = active.hnr_promise_met_percent;

  return (
    <V1Card
      reportId="br-hnr"
      title="Hot-N-Ready"
      category="operations"
      period="R"
      span={1}
      showPeriodBadge={!orders}
      bodyClassName="overflow-hidden"
      onExpand={() => setOpen(true)}
      headerControl={
        orders ? (
          <V1Toggle className="ms-1" options={HNR_SCOPE_OPTIONS} value={scope} onChange={setScope} />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-1">
        <div className="mx-auto w-full max-w-[260px]">
          <SpeedometerGauge
            value={pct}
            max={PERCENT}
            zones={HNR_ZONES}
            statusLabel={getLaborLabel(pct)}
            statusColor="#DC2626"
            valueDisplay={fmtPct(pct)}
          />
        </div>
        <div className="h-4 shrink-0" />
        <V1MetricGrid cols={3}>
          <V1Metric size="sm" label="Trans." value={<Count value={active.hnr_transactions} />} />
          <V1Metric
            size="sm"
            label="Kept"
            accent="text-emerald-600 dark:text-emerald-400"
            value={
              <span className="flex min-w-0 items-center gap-1">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                <Count value={active.hnr_promise_met} />
              </span>
            }
          />
          <V1Metric
            size="sm"
            label="Broken"
            accent={cn(active.hnr_broken_promises > 0 && "text-red-600 dark:text-red-400")}
            value={
              <span className="flex min-w-0 items-center gap-1">
                <XCircle className="h-3 w-3 shrink-0" />
                <Count value={active.hnr_broken_promises} />
              </span>
            }
          />
        </V1MetricGrid>
      </div>
      {open && <HnrDialog ops={data} orders={orders} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
