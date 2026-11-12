"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1MetricGrid, V1StackedBar, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { isNotableDeparture } from "@/components/labor/labor-turnover";
import {
  DASH,
  fmtCurrency,
  fmtHours,
  fmtNumber,
  fmtPercent,
  fmtTenure,
  reasonLabel,
} from "@/components/labor/labor-format";
import { PCT_DIGITS } from "@/components/business-reports/report-format";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { StoreChecklist, inStores } from "@/components/business-reports/store-checklist";
import { cn } from "@/lib/utils";
import type { LaborReport, LaborTurnoverEvent } from "@/types/business-reports.types";
import { PREVIEW_ROWS, ROW_CARD_HEIGHT, SeeAll, StoreTag, TWO_DP, employeeName, safeDay } from "./br-people-kit";
import { compareText, share } from "../../report-format";

/* ──────────────────────────────────────────────────────────────────────────
 *  Turnover — separations over the range (all loaded stores): counts, rate,
 *  reasons, and every departure (dialog) with its impact snapshot.
 * ────────────────────────────────────────────────────────────────────────── */

const VOLUNTARY_RAMP = ["#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"];
const INVOLUNTARY_RAMP = ["#f43f5e", "#fb7185", "#fda4af", "#fecdd3"];

const NOTABLE_BADGE =
  "h-4 shrink-0 gap-0.5 border-amber-500/40 bg-amber-500/15 px-1 text-[9px] font-semibold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300";

function notable(e: LaborTurnoverEvent): boolean {
  return e.impact_snapshot ? isNotableDeparture(e.impact_snapshot) : false;
}

function TypeBadge({ type, large }: { type: LaborTurnoverEvent["type"]; large?: boolean }) {
  return (
    <Badge
      variant={type === "voluntary" ? "secondary" : "outline"}
      className={cn("shrink-0", large ? "h-5 px-1.5 text-xs" : "h-4 px-1 text-[9px]")}
    >
      {type === "voluntary" ? "Resigned" : "Terminated"}
    </Badge>
  );
}

function NotableBadge({ large }: { large?: boolean }) {
  return (
    <Badge className={cn(NOTABLE_BADGE, large && "h-5 px-1.5 text-xs")}>
      <AlertTriangle className="h-2.5 w-2.5" />
      Notable
    </Badge>
  );
}

/** Employee vs store average, side by side (tri-state: null = not enough data). */
function Comparison({ label, employee, store, above }: { label: string; employee: string; store: string; above: boolean | null }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/40 py-1 last:border-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-[13px] tabular-nums">
        <span className={cn("font-semibold", above === true && "text-emerald-600 dark:text-emerald-400")}>{employee}</span>
        <span className="text-muted-foreground/60">vs</span>
        <span className="text-muted-foreground">{store}</span>
        {above === true && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs font-semibold">
            above avg
          </Badge>
        )}
      </span>
    </div>
  );
}

function EventDetail({ event, onClose }: { event: LaborTurnoverEvent; onClose: () => void }) {
  const { storeName } = useReport();
  const snap = event.impact_snapshot;
  const stats: ReportStat[] = [
    { label: "Type", value: event.type === "voluntary" ? "Resigned" : "Terminated", sub: event.type },
    { label: "Effective", value: safeDay(event.effective_date) },
    { label: "Reason", value: reasonLabel(event.reason, event.reason_matched) },
    { label: "Tenure at exit", value: fmtTenure(event.tenure_days) },
    { label: "Avg hourly pay", value: fmtCurrency(snap?.avg_hourly_pay ?? null) },
    { label: "Status", value: event.status ?? DASH, sub: notable(event) ? "notable departure" : undefined },
  ];
  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={employeeName(event.name, event.employee_id)}
      category="people"
      subtitle={storeName(event.store)}
      stats={stats}
    >
      {snap ? (
        <ReportBlock title={`Last ${snap.lookback_days} days — employee vs. store average`}>
          <Comparison
            label="Avg weekly hours"
            employee={fmtHours(snap.avg_weekly_hours)}
            store={fmtHours(snap.store_avg_weekly_hours_same_period)}
            above={snap.above_average_hours}
          />
          <Comparison
            label="Avg performance score"
            employee={fmtNumber(snap.avg_performance_score, TWO_DP)}
            store={fmtNumber(snap.store_avg_performance_score_same_period, TWO_DP)}
            above={snap.above_average_performance}
          />
        </ReportBlock>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">No impact snapshot for this departure.</p>
      )}
    </ReportDialog>
  );
}

interface StoreRow {
  store: string;
  separations: number;
  voluntary: number;
  involuntary: number;
  rate: number | null;
  headcount: number;
}

interface ReasonRow {
  reason: string;
  type: string;
  count: number;
}

function TurnoverDialog({
  data,
  events,
  columns,
  onSelect,
  onClose,
}: {
  data: LaborReport;
  events: LaborTurnoverEvent[];
  columns: PagedColumn<LaborTurnoverEvent>[];
  onSelect: (e: LaborTurnoverEvent) => void;
  onClose: () => void;
}) {
  const { storeName } = useReport();
  const [stores, setStores] = useState<string[]>([]);
  const t = data.combined.turnover;
  const filtered = useMemo(() => inStores(events, stores, (e) => e.store), [events, stores]);

  const storeRows = useMemo<StoreRow[]>(
    () =>
      Object.entries(data.by_store).map(([store, block]) => ({
        store,
        separations: block.turnover.separations_count,
        voluntary: block.turnover.voluntary_count,
        involuntary: block.turnover.involuntary_count,
        rate: block.turnover.turnover_rate_percent,
        headcount: block.summary.headcount_end,
      })),
    [data.by_store],
  );
  const storeColumns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      { key: "store", header: "Store", render: (r) => <span className="font-medium">{storeName(r.store)}</span>, sortValue: (r) => storeName(r.store) },
      { key: "seps", header: "Separations", numeric: true, render: (r) => fmtNumber(r.separations), sortValue: (r) => r.separations },
      { key: "vol", header: "Voluntary", numeric: true, render: (r) => fmtNumber(r.voluntary), sortValue: (r) => r.voluntary },
      { key: "invol", header: "Involuntary", numeric: true, render: (r) => fmtNumber(r.involuntary), sortValue: (r) => r.involuntary },
      { key: "rate", header: "Rate", numeric: true, render: (r) => fmtPercent(r.rate, PCT_DIGITS), sortValue: (r) => r.rate },
      { key: "hc", header: "Headcount (end)", numeric: true, render: (r) => fmtNumber(r.headcount), sortValue: (r) => r.headcount },
    ],
    [storeName],
  );

  const reasons = useMemo<ReasonRow[]>(() => t.by_reason.filter((r) => r.count > 0), [t.by_reason]);
  const reasonColumns = useMemo<PagedColumn<ReasonRow>[]>(
    () => [
      { key: "reason", header: "Reason", render: (r) => <span className="font-medium">{reasonLabel(r.reason)}</span>, sortValue: (r) => reasonLabel(r.reason) },
      { key: "type", header: "Type", render: (r) => (r.type === "voluntary" ? "Resigned" : "Terminated"), sortValue: (r) => r.type },
      { key: "count", header: "Separations", numeric: true, render: (r) => fmtNumber(r.count), sortValue: (r) => r.count },
      {
        key: "share",
        header: "Share",
        numeric: true,
        render: (r) => fmtPercent(share(r.count, t.separations_count), PCT_DIGITS),
        sortValue: (r) => r.count,
      },
    ],
    [t.separations_count],
  );

  const notableCount = events.filter(notable).length;
  const stats: ReportStat[] = [
    { label: "Separations", value: fmtNumber(t.separations_count) },
    { label: "Voluntary", value: fmtNumber(t.voluntary_count) },
    { label: "Involuntary", value: fmtNumber(t.involuntary_count) },
    { label: "Turnover rate", value: fmtPercent(t.turnover_rate_percent, PCT_DIGITS) },
    { label: "Notable", value: fmtNumber(notableCount), sub: "above-average performers", tone: notableCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined },
    { label: "Stores", value: fmtNumber(storeRows.filter((r) => r.separations > 0).length), sub: "with a separation" },
  ];
  const search = (e: LaborTurnoverEvent) =>
    `${employeeName(e.name, e.employee_id)} ${storeName(e.store)} ${reasonLabel(e.reason, e.reason_matched)}`;
  const storeSearch = (r: StoreRow) => storeName(r.store);

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Turnover"
      category="people"
      stats={stats}
      tabs={[
        {
          key: "events",
          label: `Departures (${events.length.toLocaleString()})`,
          content: (
            <div className="space-y-2">
              <StoreChecklist value={stores} onChange={setStores} />
              <PagedTable
                key={stores.join(",")}
                size="lg"
                rows={filtered}
                columns={columns}
                rowKey={(e) => `${e.store}-${e.employee_id}-${e.effective_date}`}
                initialSort="date"
                onRowClick={onSelect}
                searchText={search}
                searchPlaceholder="Search departures…"
                footerNote="click a departure for its impact snapshot"
              />
            </div>
          ),
        },
        {
          key: "stores",
          label: `By store (${storeRows.length})`,
          content: (
            <PagedTable
              size="lg"
              rows={storeRows}
              columns={storeColumns}
              rowKey={(r) => r.store}
              initialSort="seps"
              searchText={storeSearch}
              searchPlaceholder="Search stores…"
            />
          ),
        },
        {
          key: "reasons",
          label: `By reason (${reasons.length})`,
          content: <PagedTable size="lg" rows={reasons} columns={reasonColumns} rowKey={(r) => `${r.type}-${r.reason}`} initialSort="count" />,
        },
      ]}
    />
  );
}

export function BrTurnover({ data }: { data: LaborReport }) {
  const { storeName } = useReport();
  const t = data.combined.turnover;
  const [listOpen, setListOpen] = useState(false);
  const [selected, setSelected] = useState<LaborTurnoverEvent | null>(null);

  const events = useMemo(
    () => [...(t.events ?? [])].sort((a, b) => compareText(b.effective_date, a.effective_date)),
    [t.events],
  );

  const segments = useMemo(() => {
    const counters = { voluntary: 0, involuntary: 0 };
    return t.by_reason
      .filter((r) => r.count > 0)
      .map((r) => {
        const isVoluntary = r.type === "voluntary";
        const ramp = isVoluntary ? VOLUNTARY_RAMP : INVOLUNTARY_RAMP;
        const idx = isVoluntary ? counters.voluntary++ : counters.involuntary++;
        return { label: `${reasonLabel(r.reason)} (${r.count})`, value: r.count, color: ramp[idx % ramp.length] };
      });
  }, [t.by_reason]);

  const columns = useMemo<PagedColumn<LaborTurnoverEvent>[]>(
    () => [
      {
        key: "name",
        header: "Employee",
        render: (e) => (
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium">{employeeName(e.name, e.employee_id)}</span>
            {notable(e) && <NotableBadge large />}
          </span>
        ),
        sortValue: (e) => employeeName(e.name, e.employee_id),
      },
      { key: "store", header: "Store", render: (e) => storeName(e.store), sortValue: (e) => storeName(e.store) },
      { key: "type", header: "Type", render: (e) => <TypeBadge type={e.type} large />, sortValue: (e) => e.type },
      { key: "date", header: "Date", render: (e) => safeDay(e.effective_date), sortValue: (e) => e.effective_date },
      {
        key: "reason",
        header: "Reason",
        render: (e) => reasonLabel(e.reason, e.reason_matched),
        sortValue: (e) => reasonLabel(e.reason, e.reason_matched),
      },
      { key: "tenure", header: "Tenure", numeric: true, render: (e) => fmtTenure(e.tenure_days), sortValue: (e) => e.tenure_days },
      {
        key: "notable",
        header: "Notable",
        render: (e) => (notable(e) ? <NotableBadge large /> : <span className="text-muted-foreground">{DASH}</span>),
        sortValue: (e) => (notable(e) ? 1 : 0),
      },
    ],
    [storeName],
  );

  const preview = events.slice(0, PREVIEW_ROWS);

  return (
    <V1Card
      reportId="br-turnover"
      title="Turnover"
      category="people"
      period="R"
      span={2}
      height={ROW_CARD_HEIGHT}
      onExpand={() => setListOpen(true)}
    >
      <div className="space-y-2">
        <V1MetricGrid cols={4}>
          <V1Metric label="Separations" value={fmtNumber(t.separations_count)} />
          <V1Metric label="Voluntary" value={fmtNumber(t.voluntary_count)} />
          <V1Metric label="Involuntary" value={fmtNumber(t.involuntary_count)} />
          <V1Metric label="Rate" value={fmtPercent(t.turnover_rate_percent, PCT_DIGITS)} />
        </V1MetricGrid>

        {segments.length > 0 && (
          <div>
            <V1SubLabel className="mb-1">By Reason</V1SubLabel>
            <V1StackedBar segments={segments} />
          </div>
        )}

        <div>
          <V1SubLabel className="mb-0.5">Departures</V1SubLabel>
          {events.length === 0 ? (
            <div className="h-14">
              <V1Empty icon={UserMinus}>No separations in this range</V1Empty>
            </div>
          ) : (
            <ul>
              {preview.map((e) => (
                <li key={`${e.store}-${e.employee_id}-${e.effective_date}`} className="border-b border-border/40 last:border-0">
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelected(e);
                    }}
                    className="flex w-full items-center gap-1.5 py-1 text-start hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{employeeName(e.name, e.employee_id)}</span>
                    <StoreTag store={e.store} className="hidden max-w-[30%] sm:inline" />
                    {notable(e) && <NotableBadge />}
                    <TypeBadge type={e.type} />
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{safeDay(e.effective_date)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {events.length > PREVIEW_ROWS && <SeeAll count={events.length} onClick={() => setListOpen(true)} />}
        </div>
      </div>

      {listOpen && (
        <TurnoverDialog data={data} events={events} columns={columns} onSelect={setSelected} onClose={() => setListOpen(false)} />
      )}
      {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}
    </V1Card>
  );
}
