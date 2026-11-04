"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1MetricGrid, V1StackedBar, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog, DetailField } from "@/components/dspr/wbr-detail-dialog";
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
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { cn } from "@/lib/utils";
import type { LaborReport, LaborTurnoverEvent } from "@/types/business-reports.types";
import { PREVIEW_ROWS, ROW_CARD_HEIGHT, SeeAll, StoreTag, TWO_DP, employeeName, safeDay } from "./br-people-kit";

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

function TypeBadge({ type }: { type: LaborTurnoverEvent["type"] }) {
  return (
    <Badge variant={type === "voluntary" ? "secondary" : "outline"} className="h-4 shrink-0 px-1 text-[9px]">
      {type === "voluntary" ? "Resigned" : "Terminated"}
    </Badge>
  );
}

function NotableBadge() {
  return (
    <Badge className={NOTABLE_BADGE}>
      <AlertTriangle className="h-2.5 w-2.5" />
      Notable
    </Badge>
  );
}

/** Employee vs store average, side by side (tri-state: null = not enough data). */
function Comparison({ label, employee, store, above }: { label: string; employee: string; store: string; above: boolean | null }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/40 py-1 last:border-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-[12px] tabular-nums">
        <span className={cn("font-semibold", above === true && "text-emerald-600 dark:text-emerald-400")}>{employee}</span>
        <span className="text-muted-foreground/60">vs</span>
        <span className="text-muted-foreground">{store}</span>
        {above === true && (
          <Badge variant="secondary" className="h-4 px-1 text-[9px] font-semibold">
            above avg
          </Badge>
        )}
      </span>
    </div>
  );
}

function EventDetail({ event }: { event: LaborTurnoverEvent }) {
  const { storeName } = useReport();
  const snap = event.impact_snapshot;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <DetailField label="Store" value={storeName(event.store)} />
        <DetailField label="Type" value={event.type === "voluntary" ? "Resigned (voluntary)" : "Terminated (involuntary)"} />
        <DetailField label="Effective" value={safeDay(event.effective_date)} />
        <DetailField label="Reason" value={reasonLabel(event.reason, event.reason_matched)} />
        <DetailField label="Tenure at exit" value={fmtTenure(event.tenure_days)} />
        {event.status && <DetailField label="Status" value={event.status} />}
      </div>
      {snap ? (
        <div>
          <V1SubLabel className="mb-1">Last {snap.lookback_days} days — employee vs. store average</V1SubLabel>
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
          <div className="flex items-center justify-between gap-2 py-1">
            <span className="text-[12px] text-muted-foreground">Avg hourly pay</span>
            <span className="text-[12px] font-semibold tabular-nums">{fmtCurrency(snap.avg_hourly_pay)}</span>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground">No impact snapshot for this departure.</p>
      )}
    </div>
  );
}

export function BrTurnover({ data }: { data: LaborReport }) {
  const { storeName } = useReport();
  const t = data.combined.turnover;
  const [listOpen, setListOpen] = useState(false);
  const [selected, setSelected] = useState<LaborTurnoverEvent | null>(null);

  const events = useMemo(
    () => [...(t.events ?? [])].sort((a, b) => b.effective_date.localeCompare(a.effective_date)),
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
            {notable(e) && <NotableBadge />}
          </span>
        ),
        sortValue: (e) => employeeName(e.name, e.employee_id),
      },
      { key: "store", header: "Store", render: (e) => storeName(e.store), sortValue: (e) => storeName(e.store) },
      { key: "type", header: "Type", render: (e) => <TypeBadge type={e.type} />, sortValue: (e) => e.type },
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
        render: (e) => (notable(e) ? <NotableBadge /> : <span className="text-muted-foreground">{DASH}</span>),
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
      onExpand={events.length > 0 ? () => setListOpen(true) : undefined}
    >
      <div className="space-y-2">
        <V1MetricGrid cols={4}>
          <V1Metric label="Separations" value={fmtNumber(t.separations_count)} />
          <V1Metric label="Voluntary" value={fmtNumber(t.voluntary_count)} />
          <V1Metric label="Involuntary" value={fmtNumber(t.involuntary_count)} />
          <V1Metric label="Rate" value={fmtPercent(t.turnover_rate_percent)} />
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
                    <StoreTag className="hidden max-w-[30%] sm:inline">{storeName(e.store)}</StoreTag>
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
        <WbrDetailDialog open={listOpen} onOpenChange={setListOpen} title="Departures" badgeText={`${events.length} separations`} className="sm:max-w-5xl">
          <PagedTable
            rows={events}
            columns={columns}
            rowKey={(e) => `${e.store}-${e.employee_id}-${e.effective_date}`}
            initialSort="date"
            onRowClick={setSelected}
            footerNote="click a departure for its impact snapshot"
          />
        </WbrDetailDialog>
      )}
      {selected && (
        <WbrDetailDialog
          open={selected !== null}
          onOpenChange={(o) => {
            if (!o) setSelected(null);
          }}
          title={employeeName(selected.name, selected.employee_id)}
          badgeText={notable(selected) ? "Notable departure" : undefined}
          className="sm:max-w-xl"
        >
          <EventDetail event={selected} />
        </WbrDetailDialog>
      )}
    </V1Card>
  );
}
