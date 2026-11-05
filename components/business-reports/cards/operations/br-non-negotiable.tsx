"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime, fmtDuration } from "@/components/dspr/wbr-format";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportTab } from "@/components/business-reports/report-dialog";
import { useReport } from "@/components/business-reports/report-context";
import type { NonNegotiableRow, OperationsSection } from "@/types/business-reports.types";
import { DetailItem, RecordsView, useRecordWeeks } from "@/components/business-reports/cards/quality/br-records";
import { NO_VALUE, ShareBars, TrendChart, plural, storeSearch, useStoreFocus, useWeekLabel } from "./br-shared";

/** Incidents listed under each action in the card body; the dialog has them all. */
const ROWS_PER_GROUP = 3;
const BAR_COLOR = CATEGORIES.operations.chartColors[0];
const fmtWhole = (v: number): string => v.toFixed(0);

interface Incident extends NonNegotiableRow {
  key: string;
  storeLabel: string;
}

interface StoreIncidents {
  store: string;
  name: string;
  count: number;
  topAction: string;
}

function timingLine(r: NonNegotiableRow): string {
  const start = fmtDateTime(r.date, r.time);
  if (!r.date_two) return start;
  const dur = fmtDuration(r.date, r.time, r.date_two, r.time_two);
  return `${start} → ${fmtDateTime(r.date_two, r.time_two)}${dur ? ` · ${dur}` : ""}`;
}

/** Groups rows by a key, largest group first. */
function groupBy<T>(rows: T[], keyOf: (row: T) => string): { key: string; items: T[] }[] {
  const groups = rows.reduce((m, r) => {
    const key = keyOf(r);
    const list = m.get(key);
    if (list) list.push(r);
    else m.set(key, [r]);
    return m;
  }, new Map<string, T[]>());
  return [...groups.entries()].map(([key, items]) => ({ key, items })).sort((a, b) => b.items.length - a.items.length);
}

const sortKeyOf = (r: NonNegotiableRow) => `${r.date} ${r.time ?? ""}`;
const dateOf = (r: Incident) => r.date;
const storeOf = (r: Incident) => r.store;
const searchText = (r: Incident) => `${r.action} ${r.storeLabel} ${r.notes ?? ""}`;

const COLUMNS: PagedColumn<Incident>[] = [
  { key: "started", header: "Started", sortValue: sortKeyOf, render: (r) => fmtDateTime(r.date, r.time), className: "whitespace-nowrap" },
  { key: "action", header: "Action", sortValue: (r) => r.action, render: (r) => r.action },
  { key: "store", header: "Store", sortValue: (r) => r.storeLabel, render: (r) => r.storeLabel },
  {
    key: "ended",
    header: "Ended",
    sortValue: (r) => r.date_two,
    render: (r) => (r.date_two ? fmtDateTime(r.date_two, r.time_two) : NO_VALUE),
    className: "whitespace-nowrap",
  },
  { key: "duration", header: "Duration", render: (r) => fmtDuration(r.date, r.time, r.date_two, r.time_two) ?? NO_VALUE },
  {
    key: "notes",
    header: "Notes",
    render: (r) => <span className="line-clamp-2 min-w-[220px] whitespace-normal">{r.notes?.trim() || NO_VALUE}</span>,
  },
];

const STORE_COLUMNS: PagedColumn<StoreIncidents>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  { key: "count", header: "Incidents", numeric: true, sortValue: (r) => r.count, render: (r) => r.count.toLocaleString() },
  { key: "top", header: "Most frequent action", sortValue: (r) => r.topAction, render: (r) => r.topAction },
];

function IncidentDetail({ r }: { r: Incident }) {
  return (
    <>
      <DetailItem label="Store" value={r.storeLabel} />
      <DetailItem label="Action" value={r.action} />
      <DetailItem label="Started" value={fmtDateTime(r.date, r.time)} />
      <DetailItem label="Ended" value={r.date_two ? fmtDateTime(r.date_two, r.time_two) : NO_VALUE} />
      <DetailItem label="Duration" value={fmtDuration(r.date, r.time, r.date_two, r.time_two)} />
      <DetailItem label="Notes" value={r.notes?.trim()} wide />
    </>
  );
}

function NonNegotiableDialog({ rows, onClose }: { rows: Incident[]; onClose: () => void }) {
  const actions = useMemo(() => groupBy(rows, (r) => r.action), [rows]);
  const stores = useMemo<StoreIncidents[]>(
    () =>
      groupBy(rows, storeOf).map((g) => ({
        store: g.key,
        name: g.items[0]?.storeLabel ?? g.key,
        count: g.items.length,
        topAction: groupBy(g.items, (r) => r.action)[0]?.key ?? NO_VALUE,
      })),
    [rows],
  );
  const focus = useStoreFocus<StoreIncidents>();
  const weeks = useRecordWeeks(rows, dateOf);
  const labelOf = useWeekLabel(weeks);
  const categories = useMemo(() => weeks.map((w) => labelOf(w.week_start)), [weeks, labelOf]);
  const series = useMemo(() => [{ name: "Incidents", data: weeks.map((w) => w.rows.length), color: BAR_COLOR }], [weeks]);

  const tabs: ReportTab[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-4 lg:grid-cols-5">
          <ReportBlock title="Incidents per week" className="lg:col-span-3">
            <TrendChart kind="bar" categories={categories} series={series} format={fmtWhole} />
          </ReportBlock>
          <ReportBlock title="By action" className="lg:col-span-2">
            <ShareBars
              size="lg"
              color={BAR_COLOR}
              rows={actions.map((a) => ({ key: a.key, label: a.key, value: a.items.length, title: a.key }))}
            />
          </ReportBlock>
        </div>
      ),
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <PagedTable
          size="lg"
          rows={stores}
          columns={STORE_COLUMNS}
          rowKey={(r) => r.store}
          initialSort="count"
          searchText={storeSearch}
          onRowClick={focus.onRowClick}
          footerNote={focus.footerNote}
        />
      ),
    },
    {
      key: "records",
      label: "Incidents",
      content: (
        <RecordsView
          rows={rows}
          columns={COLUMNS}
          rowKey={(r) => r.key}
          initialSort="started"
          searchText={searchText}
          storeOf={storeOf}
          detailTitle={(r) => (
            <span className="flex flex-wrap items-baseline justify-between gap-2">
              <span>{r.action}</span>
              <span className="text-sm font-normal text-muted-foreground">{r.storeLabel}</span>
            </span>
          )}
          renderDetail={(r) => <IncidentDetail r={r} />}
        />
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Non-Negotiable Reports"
      category="operations"
      stats={[
        { label: "Incidents", value: rows.length.toLocaleString(), tone: "text-red-600 dark:text-red-400" },
        { label: "Actions", value: actions.length.toLocaleString(), sub: actions[0] ? `most: ${actions[0].key}` : undefined },
        { label: "Stores", value: stores.length.toLocaleString(), sub: "with an incident" },
        { label: "Still open", value: rows.filter((r) => !r.date_two).length.toLocaleString(), sub: "no end recorded" },
      ]}
      tabs={tabs}
    />
  );
}

/** Non-negotiable incidents across the stores, grouped by action. */
export function BrNonNegotiableCard({ data }: { data: OperationsSection }) {
  const { storeName } = useReport();
  const [open, setOpen] = useState(false);
  const rows = useMemo<Incident[]>(
    () =>
      data.non_negotiables.map((r, i) => ({
        ...r,
        key: `${r.store}-${r.date}-${r.time ?? ""}-${i}`,
        storeLabel: storeName(r.store),
      })),
    [data.non_negotiables, storeName],
  );
  const groups = useMemo(() => groupBy(rows, (r) => r.action), [rows]);
  const empty = rows.length === 0;

  return (
    <V1Card
      reportId="br-non-negotiable"
      title="Non-Negotiable Reports"
      category="operations"
      period="R"
      span={2}
      onExpand={empty ? undefined : () => setOpen(true)}
      headerNote={
        <Badge
          variant="secondary"
          className={cn(
            "h-4 px-1.5 py-0 text-[10px] tabular-nums",
            empty
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/15 text-red-600 dark:text-red-400",
          )}
          title={plural(rows.length, "incident")}
        >
          {rows.length.toLocaleString()}
        </Badge>
      }
    >
      {empty ? (
        <V1Empty icon={CheckCircle2}>
          <span className="text-emerald-600 dark:text-emerald-400">All clear — no incidents in this range.</span>
        </V1Empty>
      ) : (
        <div>
          {groups.map((g, gi) => (
            <div key={g.key}>
              {gi > 0 && <hr className="my-2 border-red-200/70 dark:border-red-800/50" />}
              <div className="mb-1.5 flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="h-4 border-red-300 px-1.5 py-0 text-[10px] font-semibold text-red-600 dark:border-red-800 dark:text-red-400"
                >
                  {g.key}
                </Badge>
                <span className="ms-auto text-[10px] tabular-nums text-muted-foreground">{g.items.length}×</span>
              </div>
              <div className="space-y-1 ps-1">
                {g.items.slice(0, ROWS_PER_GROUP).map((r) => (
                  <div key={r.key} className="rounded bg-background/40 px-2 py-1">
                    <p className="flex items-center justify-between gap-2 text-[11px] font-medium leading-snug">
                      <span className="truncate">{r.storeLabel}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{timingLine(r)}</span>
                    </p>
                    {r.notes?.trim() && <p className="line-clamp-1 text-[10px] text-muted-foreground">{r.notes.trim()}</p>}
                  </div>
                ))}
                {g.items.length > ROWS_PER_GROUP && (
                  <p className="px-2 text-[10px] text-muted-foreground">
                    +{(g.items.length - ROWS_PER_GROUP).toLocaleString()} more — open for all
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && <NonNegotiableDialog rows={rows} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
