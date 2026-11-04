"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Toggle, V1_NUM, V1_TBL, V1_TD, V1_TH } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useSection } from "@/components/business-reports/report-context";
import { fmtNum, fmtPct, fmtRange, weekLabel } from "@/components/business-reports/report-format";
import type {
  HnrTotals,
  OperationsMetrics,
  OperationsSection,
  OrdersSection,
  ReportWeek,
} from "@/types/business-reports.types";
import { NO_VALUE, PpDelta, plural } from "./br-shared";
import { HNR_SCOPE_OPTIONS, type HnrScope } from "./br-hnr";

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
  const chronological = [...ops.by_week].sort((a, b) => a.week_start.localeCompare(b.week_start));
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

const COLUMNS: PagedColumn<WeekRow>[] = [
  { key: "week", header: "Week", sortValue: (r) => r.week.week_start, render: (r) => weekLabel(r.week), className: "whitespace-nowrap" },
  { key: "eligible", header: "Eligible", numeric: true, sortValue: (r) => r.week.portal_eligible_orders, render: (r) => fmtNum(r.week.portal_eligible_orders) },
  { key: "used", header: "Used", numeric: true, sortValue: (r) => r.week.portal_used_orders, render: (r) => fmtNum(r.week.portal_used_orders) },
  { key: "ontime", header: "On-Time", numeric: true, sortValue: (r) => r.week.portal_on_time_orders, render: (r) => fmtNum(r.week.portal_on_time_orders) },
  { key: "portal", header: "Portal %", numeric: true, sortValue: (r) => r.week.in_portal_on_time_percent, render: (r) => fmtPct(r.week.in_portal_on_time_percent) },
  { key: "portal_d", header: "Δ", numeric: true, render: (r) => <PpDelta curr={r.week.in_portal_on_time_percent} prev={r.prevPortal} /> },
  { key: "trans", header: "HNR Txns", numeric: true, sortValue: (r) => r.hnr?.hnr_transactions, render: (r) => hnrCell(r, (h) => h.hnr_transactions, fmtNum) },
  { key: "broken", header: "Broken", numeric: true, sortValue: (r) => r.hnr?.hnr_broken_promises, render: (r) => hnrCell(r, (h) => h.hnr_broken_promises, fmtNum) },
  { key: "met", header: "Met", numeric: true, sortValue: (r) => r.hnr?.hnr_promise_met, render: (r) => hnrCell(r, (h) => h.hnr_promise_met, fmtNum) },
  { key: "hnr", header: "HNR %", numeric: true, sortValue: (r) => r.hnr?.hnr_promise_met_percent, render: (r) => hnrCell(r, (h) => h.hnr_promise_met_percent, fmtPct) },
  {
    key: "hnr_d",
    header: "Δ",
    numeric: true,
    render: (r) => (r.hnr ? <PpDelta curr={r.hnr.hnr_promise_met_percent} prev={r.prevHnr} /> : <Dash />),
  },
];

function WeeklyDialog({
  ops,
  orders,
  onClose,
}: {
  ops: OperationsSection;
  orders: OrdersSection | null;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<HnrScope>("all");
  const rows = useMemo(() => buildRows(ops, orders, scope), [ops, orders, scope]);
  return (
    <WbrDetailDialog open onOpenChange={(o) => !o && onClose()} title="Portal & HNR — Weekly" badgeText={plural(rows.length, "week")}>
      {orders && (
        <div className="mb-3 flex justify-end">
          <V1Toggle options={HNR_SCOPE_OPTIONS} value={scope} onChange={setScope} />
        </div>
      )}
      <PagedTable key={scope} rows={rows} columns={COLUMNS} rowKey={(r) => r.week.week_start} initialSort="week" />
      <p className="mt-3 text-[11px] text-muted-foreground">
        Δ compares each week to the previous week in the range. Portal % = in-portal on-time; HNR % = promise met
        {scope === "special" ? " (Special Items)" : ""}.
      </p>
    </WbrDetailDialog>
  );
}

/** Week-over-week Portal % and HNR % inside the loaded range, latest week first. */
export function BrPortalWeeklyCard({ data }: { data: OperationsSection }) {
  const orders = useSection("orders").data;
  const [scope, setScope] = useState<HnrScope>("all");
  const [open, setOpen] = useState(false);
  const effectiveScope: HnrScope = orders ? scope : "all";
  const rows = useMemo(() => buildRows(data, orders, effectiveScope), [data, orders, effectiveScope]);
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
                <td className={cn(V1_TD, "whitespace-nowrap")}>
                  <span className="font-medium">Wk {r.week.week_number}</span>{" "}
                  <span className="text-muted-foreground">{fmtRange(r.week.start, r.week.end)}</span>
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
