"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1MetricGrid, V1StackedBar, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { DASH, fmtNumber } from "@/components/labor/labor-format";
import { ApexChart, useChartTheme } from "@/components/business-reports/chart";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { StoreChecklist, inStores } from "@/components/business-reports/store-checklist";
import type { DebriefTypeCount, DebriefsSection } from "@/types/business-reports.types";
import { ActiveToggle, ROW_CARD_HEIGHT, TWO_DP, employeeName, matchesActive, peopleLineOptions, safeDay, type ActiveFilter } from "./br-people-kit";
import { compareText, weekLabel } from "../../report-format";

/* ──────────────────────────────────────────────────────────────────────────
 *  Debriefs — the Employee report's debrief summary over the range for every
 *  loaded store: totals, type mix, the weekly line, and (dialog) every
 *  event, employee and store.
 * ────────────────────────────────────────────────────────────────────────── */

/** Distinct hue per type (same set as the Employee report's breakdown). */
const SEGMENT_COLORS = ["#8b5cf6", "#f43f5e", "#0ea5e9", "#f59e0b", "#10b981", "#71717a"];
const CHART_PX = 120;
const DIALOG_CHART_PX = 300;
const BADGE_LG = "h-5 px-1.5 text-xs";
const UNTYPED = "Untyped";

type DebriefEvent = DebriefsSection["events"][number];
type DebriefEmployee = DebriefsSection["employees"][number];
interface StoreRow {
  store: string;
  active_employees: number;
  total_count: number;
  by_type: DebriefTypeCount[];
}

function typeLabel(t: { label: string } | null | undefined): string {
  return t?.label ?? UNTYPED;
}

/** "Coaching 4 · Write-up 1" — the non-zero types of one row. */
function typeMix(byType: DebriefTypeCount[]): string {
  const parts = byType.filter((t) => t.count > 0).map((t) => `${typeLabel(t.type)} ${t.count}`);
  return parts.length > 0 ? parts.join(" · ") : DASH;
}

function DebriefsDialog({ data, onClose }: { data: DebriefsSection; onClose: () => void }) {
  const { storeName } = useReport();
  const theme = useChartTheme();
  const [stores, setStores] = useState<string[]>([]);
  const [active, setActive] = useState<ActiveFilter>("active");
  const s = data.summary;

  const events = useMemo(() => [...data.events].sort((a, b) => compareText(b.date, a.date)), [data.events]);
  const storeRows = useMemo<StoreRow[]>(
    () => Object.entries(data.by_store).map(([store, block]) => ({ store, ...block })),
    [data.by_store],
  );

  const eventColumns = useMemo<PagedColumn<DebriefEvent>[]>(
    () => [
      { key: "date", header: "Date", render: (e) => safeDay(e.date), sortValue: (e) => e.date },
      { key: "store", header: "Store", render: (e) => storeName(e.store), sortValue: (e) => storeName(e.store) },
      {
        key: "employee",
        header: "Employee",
        render: (e) => <span className="font-medium">{employeeName(e.employee_name, e.employee_id)}</span>,
        sortValue: (e) => employeeName(e.employee_name, e.employee_id),
      },
      {
        key: "type",
        header: "Type",
        render: (e) => (
          <Badge variant="outline" className={BADGE_LG}>
            {typeLabel(e.type)}
          </Badge>
        ),
        sortValue: (e) => typeLabel(e.type),
      },
      {
        key: "note",
        header: "Note",
        render: (e) => <span className="line-clamp-2 max-w-md whitespace-normal break-words">{e.note ?? DASH}</span>,
      },
      { key: "author", header: "Author", render: (e) => e.author ?? DASH, sortValue: (e) => e.author },
    ],
    [storeName],
  );

  const employeeColumns = useMemo<PagedColumn<DebriefEmployee>[]>(
    () => [
      { key: "name", header: "Employee", render: (e) => <span className="font-medium">{e.name}</span>, sortValue: (e) => e.name },
      { key: "store", header: "Store", render: (e) => storeName(e.store), sortValue: (e) => storeName(e.store) },
      {
        key: "active",
        header: "Status",
        render: (e) => (
          <Badge variant={e.active ? "secondary" : "outline"} className={BADGE_LG}>
            {e.active ? "Active" : "Inactive"}
          </Badge>
        ),
        sortValue: (e) => (e.active ? 1 : 0),
      },
      { key: "mix", header: "By type", render: (e) => <span className="text-muted-foreground">{typeMix(e.debriefs.by_type)}</span> },
      { key: "total", header: "Debriefs", numeric: true, render: (e) => fmtNumber(e.debriefs.total_count), sortValue: (e) => e.debriefs.total_count },
    ],
    [storeName],
  );

  const storeColumns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      { key: "store", header: "Store", render: (s) => <span className="font-medium">{storeName(s.store)}</span>, sortValue: (s) => storeName(s.store) },
      { key: "active", header: "Active Emp.", numeric: true, render: (s) => fmtNumber(s.active_employees), sortValue: (s) => s.active_employees },
      { key: "mix", header: "By type", render: (s) => <span className="text-muted-foreground">{typeMix(s.by_type)}</span> },
      { key: "total", header: "Debriefs", numeric: true, render: (s) => fmtNumber(s.total_count), sortValue: (s) => s.total_count },
      {
        key: "per",
        header: "Per Employee",
        numeric: true,
        render: (s) => (s.active_employees > 0 ? fmtNumber(s.total_count / s.active_employees, TWO_DP) : DASH),
        sortValue: (s) => (s.active_employees > 0 ? s.total_count / s.active_employees : null),
      },
    ],
    [storeName],
  );

  const filteredEvents = useMemo(() => inStores(events, stores, (e) => e.store), [events, stores]);
  const filteredEmployees = useMemo(
    () => inStores(data.employees, stores, (e) => e.store).filter((e) => matchesActive(e.active, active)),
    [data.employees, stores, active],
  );

  const options = useMemo(
    () => peopleLineOptions(theme, data.weeks.map((w) => weekLabel(w)), (v) => fmtNumber(v)),
    [theme, data.weeks],
  );
  const series = useMemo(() => [{ name: "Debriefs", data: data.weeks.map((w) => w.total_count) }], [data.weeks]);

  const stats: ReportStat[] = [
    { label: "Debriefs", value: fmtNumber(s.total_debriefs) },
    { label: "Avg / week", value: fmtNumber(s.avg_weekly_debriefs, 1) },
    { label: "Most common", value: s.most_common_type?.label ?? DASH },
    { label: "Active employees", value: fmtNumber(s.active_employees), sub: `${fmtNumber(s.inactive_employees)} inactive` },
    {
      label: "Per active employee",
      value: s.active_employees > 0 ? fmtNumber(s.total_debriefs / s.active_employees, TWO_DP) : DASH,
    },
    { label: "Stores", value: fmtNumber(storeRows.length) },
  ];
  const eventSearch = (e: DebriefEvent) =>
    `${employeeName(e.employee_name, e.employee_id)} ${storeName(e.store)} ${typeLabel(e.type)} ${e.note ?? ""} ${e.author ?? ""}`;
  const employeeSearch = (e: DebriefEmployee) => `${e.name} ${storeName(e.store)}`;
  const storeSearch = (r: StoreRow) => storeName(r.store);

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Debriefs"
      category="people"
      stats={stats}
      tabs={[
        {
          key: "overview",
          label: "By week",
          content: (
            <ReportBlock title="Debriefs per week" description="Every loaded store together, by week number.">
              {data.weeks.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No weeks in this range</p>
              ) : (
                <ApexChart key={theme.key} options={options} series={series} type="line" height={DIALOG_CHART_PX} />
              )}
            </ReportBlock>
          ),
        },
        {
          key: "events",
          label: `Events (${events.length.toLocaleString()})`,
          content: (
            <div className="space-y-2">
              <StoreChecklist value={stores} onChange={setStores} />
              <PagedTable
                key={stores.join(",")}
                size="lg"
                rows={filteredEvents}
                columns={eventColumns}
                rowKey={(e) => e.debrief_id}
                initialSort="date"
                searchText={eventSearch}
                searchPlaceholder="Search debriefs…"
              />
            </div>
          ),
        },
        {
          key: "employees",
          label: `Employees (${data.employees.length.toLocaleString()})`,
          content: (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <ActiveToggle value={active} onChange={setActive} />
                <StoreChecklist value={stores} onChange={setStores} />
              </div>
              <PagedTable
                key={`${stores.join(",")}|${active}`}
                size="lg"
                rows={filteredEmployees}
                columns={employeeColumns}
                rowKey={(e) => `${e.store}-${e.employee_id}`}
                initialSort="total"
                searchText={employeeSearch}
                searchPlaceholder="Search employees…"
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
              initialSort="total"
              searchText={storeSearch}
              searchPlaceholder="Search stores…"
            />
          ),
        },
      ]}
    />
  );
}

export function BrDebriefs({ data }: { data: DebriefsSection }) {
  const theme = useChartTheme();
  const [open, setOpen] = useState(false);
  const s = data.summary;

  const segments = useMemo(
    () =>
      data.by_type
        .filter((e) => e.count > 0)
        .map((e, i) => ({
          label: `${typeLabel(e.type)} (${e.count})`,
          value: e.count,
          color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        })),
    [data.by_type],
  );

  const options = useMemo(
    () => peopleLineOptions(theme, data.weeks.map((w) => weekLabel(w)), (v) => fmtNumber(v)),
    [theme, data.weeks],
  );
  const series = useMemo(() => [{ name: "Debriefs", data: data.weeks.map((w) => w.total_count) }], [data.weeks]);
  const hasAny = s.total_debriefs > 0 || data.events.length > 0;

  return (
    <V1Card
      reportId="br-debriefs"
      title="Debriefs"
      category="people"
      period="R"
      span={4}
      height={ROW_CARD_HEIGHT}
      onExpand={hasAny ? () => setOpen(true) : undefined}
    >
      {hasAny ? (
        <div className="space-y-1.5">
          <V1MetricGrid cols={4}>
            <V1Metric label="Debriefs" value={fmtNumber(s.total_debriefs)} accent={s.total_debriefs > 0 ? "text-rose-600 dark:text-rose-400" : undefined} />
            <V1Metric label="Most Common" value={s.most_common_type?.label ?? DASH} size="sm" />
            <V1Metric label="Avg / Week" value={fmtNumber(s.avg_weekly_debriefs, 1)} />
            <V1Metric label="Active Emp." value={fmtNumber(s.active_employees)} sub={`${fmtNumber(s.inactive_employees)} inactive`} />
          </V1MetricGrid>
          {segments.length > 0 && (
            <div>
              <V1SubLabel className="mb-1">By Type</V1SubLabel>
              <V1StackedBar segments={segments} />
            </div>
          )}
          {data.weeks.length > 1 && (
            <div>
              <V1SubLabel>Weekly</V1SubLabel>
              <ApexChart key={theme.key} options={options} series={series} type="line" height={CHART_PX} />
            </div>
          )}
        </div>
      ) : (
        <V1Empty icon={ClipboardList}>No debriefs logged in this range</V1Empty>
      )}

      {open && <DebriefsDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
