"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { SpeedometerGauge, type SpeedZone } from "@/components/dspr/speedometer-gauge";
import { getLaborLabel } from "@/components/dspr/portal-meter-utils";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1SubLabel, V1Toggle } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useSection } from "@/components/business-reports/report-context";
import { fmtNum, fmtPct, weekLabel } from "@/components/business-reports/report-format";
import type { HnrTotals, OperationsSection, OrdersSection, ReportWeek } from "@/types/business-reports.types";
import { PERCENT, useStoreFocus, useStoreRows, type StoreRow } from "./br-shared";

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

interface HnrSource {
  totals: HnrTotals;
  byStore: Record<string, HnrTotals>;
  byWeek: Array<ReportWeek & HnrTotals>;
}

/** All = store-wide HnR (operations); Special = the important items (orders). */
function hnrSource(scope: HnrScope, ops: OperationsSection, orders: OrdersSection | null): HnrSource {
  if (scope === "special" && orders) {
    const s = orders.important_items_hnr;
    return { totals: s.totals, byStore: s.by_store, byWeek: s.by_week };
  }
  return { totals: ops.totals, byStore: ops.by_store, byWeek: ops.by_week };
}

function hnrColumns<T>(get: (row: T) => HnrTotals): PagedColumn<T>[] {
  return [
    { key: "met_pct", header: "Promise Met %", numeric: true, sortValue: (r) => get(r).hnr_promise_met_percent, render: (r) => fmtPct(get(r).hnr_promise_met_percent) },
    { key: "trans", header: "Trans.", numeric: true, sortValue: (r) => get(r).hnr_transactions, render: (r) => fmtNum(get(r).hnr_transactions) },
    { key: "kept", header: "Kept", numeric: true, sortValue: (r) => get(r).hnr_promise_met, render: (r) => fmtNum(get(r).hnr_promise_met) },
    { key: "broken", header: "Broken", numeric: true, sortValue: (r) => get(r).hnr_broken_promises, render: (r) => fmtNum(get(r).hnr_broken_promises) },
  ];
}

type WeekRow = ReportWeek & HnrTotals;

const WEEK_COLUMNS: PagedColumn<WeekRow>[] = [
  { key: "week", header: "Week", sortValue: (w) => w.week_start, render: (w) => weekLabel(w), className: "whitespace-nowrap" },
  ...hnrColumns<WeekRow>((w) => w),
];

const STORE_COLUMNS: PagedColumn<StoreRow<HnrTotals>>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  ...hnrColumns<StoreRow<HnrTotals>>((r) => r.data),
];

function HnrDialog({
  ops,
  orders,
  onClose,
}: {
  ops: OperationsSection;
  orders: OrdersSection | null;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<HnrScope>("all");
  const source = hnrSource(scope, ops, orders);
  const stores = useStoreRows(source.byStore);
  const focus = useStoreFocus<StoreRow<HnrTotals>>();
  const scopeLabel = scope === "special" ? "Special Items" : "All Items";

  return (
    <WbrDetailDialog open onOpenChange={(o) => !o && onClose()} title="Hot-N-Ready" badgeText={`${scopeLabel} · By week · By store`}>
      {orders && (
        <div className="mb-3 flex justify-end">
          <V1Toggle
            options={[
              { value: "all", label: "All Items" },
              { value: "special", label: "Special Items" },
            ]}
            value={scope}
            onChange={setScope}
          />
        </div>
      )}
      <div className="space-y-5">
        <div>
          <V1SubLabel className="mb-1">By week</V1SubLabel>
          <PagedTable key={`w-${scope}`} rows={source.byWeek} columns={WEEK_COLUMNS} rowKey={(w) => w.week_start} initialSort="week" />
        </div>
        <div>
          <V1SubLabel className="mb-1">By store</V1SubLabel>
          <PagedTable
            key={`s-${scope}`}
            rows={stores}
            columns={STORE_COLUMNS}
            rowKey={(r) => r.store}
            initialSort="met_pct"
            onRowClick={focus.onRowClick}
            footerNote={focus.footerNote}
          />
        </div>
      </div>
    </WbrDetailDialog>
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
            max={100}
            zones={HNR_ZONES}
            statusLabel={getLaborLabel(pct)}
            statusColor="#DC2626"
            valueDisplay={fmtPct(pct)}
          />
        </div>
        <div className="h-4 shrink-0" />
        <V1MetricGrid cols={3}>
          <V1Metric size="sm" label="Trans." value={fmtNum(active.hnr_transactions)} />
          <V1Metric
            size="sm"
            label="Kept"
            accent="text-emerald-600 dark:text-emerald-400"
            value={
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {fmtNum(active.hnr_promise_met)}
              </span>
            }
          />
          <V1Metric
            size="sm"
            label="Broken"
            accent={active.hnr_broken_promises > 0 ? "text-red-600 dark:text-red-400" : undefined}
            value={
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {fmtNum(active.hnr_broken_promises)}
              </span>
            }
          />
        </V1MetricGrid>
      </div>
      {open && <HnrDialog ops={data} orders={orders} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
