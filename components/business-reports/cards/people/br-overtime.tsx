"use client";

import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1Toggle } from "@/components/dashboard-v1/v1-ui";
import { DASH, fmtHours, fmtNumber } from "@/components/labor/labor-format";
import { ApexChart, useChartTheme } from "@/components/business-reports/chart";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { compareText, weekLabel } from "@/components/business-reports/report-format";
import { StoreChecklist, inStores } from "@/components/business-reports/store-checklist";
import type { LaborOvertimeRow, LaborReport } from "@/types/business-reports.types";
import { ROW_CARD_HEIGHT, employeeName, peopleBarOptions } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Overtime — employee-weeks over the 40h / 60h thresholds across the range
 *  (covers V1's "Above 60 Hours Employees"). Thresholds come from the API.
 *  Weeks show as the project-wide week number ("Wk 43"). The dialog breaks
 *  the employee-weeks down by week, by store and by employee.
 * ────────────────────────────────────────────────────────────────────────── */

type Band = "40" | "60";

const ROSE = "text-rose-600 dark:text-rose-400";
const DIALOG_CHART_PX = 300;

interface WeekRow {
  week_start: string;
  over40: number;
  over60: number;
  hours: number;
}

interface StoreRow {
  store: string;
  over40: number;
  over60: number;
  employees: number;
  otHours: number;
}

function rowKey(r: LaborOvertimeRow): string {
  return `${r.store}-${r.employee_id}-${r.week_start}`;
}

function useRowColumns(t60: number): PagedColumn<LaborOvertimeRow>[] {
  const { storeName } = useReport();
  return useMemo<PagedColumn<LaborOvertimeRow>[]>(
    () => [
      {
        key: "name",
        header: "Employee",
        render: (r) => <span className="font-medium">{employeeName(r.name, r.employee_id)}</span>,
        sortValue: (r) => employeeName(r.name, r.employee_id),
      },
      { key: "store", header: "Store", render: (r) => storeName(r.store), sortValue: (r) => storeName(r.store) },
      {
        key: "position",
        header: "Position",
        render: (r) => <span className="text-muted-foreground">{r.position ?? DASH}</span>,
        sortValue: (r) => r.position,
      },
      { key: "week", header: "Week", render: (r) => weekLabel(r), sortValue: (r) => r.week_start },
      {
        key: "hours",
        header: "Hours",
        numeric: true,
        render: (r) => <span className={r.total_hours > t60 ? ROSE : "font-semibold"}>{fmtHours(r.total_hours)}</span>,
        sortValue: (r) => r.total_hours,
      },
      { key: "ot", header: "OT", numeric: true, render: (r) => fmtHours(r.overtime_hours), sortValue: (r) => r.overtime_hours },
    ],
    [storeName, t60],
  );
}

function OvertimeDialog({ data, onClose }: { data: LaborReport; onClose: () => void }) {
  const theme = useChartTheme();
  const { storeName } = useReport();
  const [stores, setStores] = useState<string[]>([]);
  const o = data.combined.overtime;
  const t40 = o.over_40_hours_threshold;
  const t60 = o.over_60_hours_threshold;
  const over40 = useMemo(() => o.over_40 ?? [], [o.over_40]);
  const over60 = useMemo(() => o.over_60 ?? [], [o.over_60]);
  const columns = useRowColumns(t60);

  const weeks = useMemo<WeekRow[]>(() => {
    const map = new Map<string, WeekRow>(
      data.weeks.map((w) => [w.week_start, { week_start: w.week_start, over40: 0, over60: 0, hours: 0 }]),
    );
    const get = (week: string): WeekRow => {
      const found = map.get(week) ?? { week_start: week, over40: 0, over60: 0, hours: 0 };
      map.set(week, found);
      return found;
    };
    over40.forEach((r) => {
      const w = get(r.week_start);
      w.over40 += 1;
      w.hours += r.overtime_hours;
    });
    over60.forEach((r) => {
      get(r.week_start).over60 += 1;
    });
    return [...map.values()].sort((a, b) => compareText(a.week_start, b.week_start));
  }, [data.weeks, over40, over60]);

  const storeRows = useMemo<StoreRow[]>(
    () =>
      Object.entries(data.by_store).map(([store, block]) => {
        const rows = over40.filter((r) => r.store === store);
        return {
          store,
          over40: block.overtime.over_40_count,
          over60: block.overtime.over_60_count,
          employees: new Set(rows.map((r) => r.employee_id)).size,
          otHours: rows.reduce((s, r) => s + r.overtime_hours, 0),
        };
      }),
    [data.by_store, over40],
  );

  const options = useMemo(
    () => ({
      ...peopleBarOptions(theme, weeks.map((w) => weekLabel(w)), (v: number) => fmtNumber(v), false),
      dataLabels: { enabled: false },
    }),
    [theme, weeks],
  );
  const series = useMemo(() => [{ name: `Over ${t40}h`, data: weeks.map((w) => w.over40) }], [weeks, t40]);

  const weekColumns = useMemo<PagedColumn<WeekRow>[]>(
    () => [
      { key: "week", header: "Week", render: (w) => <span className="font-medium">{weekLabel(w, true)}</span>, sortValue: (w) => w.week_start },
      { key: "o40", header: `Over ${t40}h`, numeric: true, render: (w) => fmtNumber(w.over40), sortValue: (w) => w.over40 },
      {
        key: "o60",
        header: `Over ${t60}h`,
        numeric: true,
        render: (w) => <span className={w.over60 > 0 ? ROSE : undefined}>{fmtNumber(w.over60)}</span>,
        sortValue: (w) => w.over60,
      },
      { key: "ot", header: "OT hours", numeric: true, render: (w) => fmtHours(w.hours), sortValue: (w) => w.hours },
    ],
    [t40, t60],
  );

  const storeColumns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      { key: "store", header: "Store", render: (r) => <span className="font-medium">{storeName(r.store)}</span>, sortValue: (r) => storeName(r.store) },
      { key: "o40", header: `Emp-weeks > ${t40}h`, numeric: true, render: (r) => fmtNumber(r.over40), sortValue: (r) => r.over40 },
      {
        key: "o60",
        header: `Emp-weeks > ${t60}h`,
        numeric: true,
        render: (r) => <span className={r.over60 > 0 ? ROSE : undefined}>{fmtNumber(r.over60)}</span>,
        sortValue: (r) => r.over60,
      },
      { key: "emp", header: "Employees", numeric: true, render: (r) => fmtNumber(r.employees), sortValue: (r) => r.employees },
      { key: "ot", header: "OT hours", numeric: true, render: (r) => fmtHours(r.otHours), sortValue: (r) => r.otHours },
    ],
    [storeName, t40, t60],
  );

  const filtered = useMemo(() => inStores(over40, stores, (r) => r.store), [over40, stores]);
  const totalOt = over40.reduce((s, r) => s + r.overtime_hours, 0);
  const worst = weeks.reduce<WeekRow | null>((m, w) => (m === null || w.over40 > m.over40 ? w : m), null);
  const stats: ReportStat[] = [
    { label: `Emp-weeks > ${t40}h`, value: fmtNumber(o.over_40_count) },
    { label: `Emp-weeks > ${t60}h`, value: fmtNumber(o.over_60_count), tone: o.over_60_count > 0 ? ROSE : undefined },
    { label: "Employees", value: fmtNumber(new Set(over40.map((r) => `${r.store}-${r.employee_id}`)).size), sub: `over ${t40}h at least once` },
    { label: "OT hours", value: fmtHours(totalOt) },
    { label: "Worst week", value: worst && worst.over40 > 0 ? weekLabel(worst) : DASH, sub: worst && worst.over40 > 0 ? `${fmtNumber(worst.over40)} emp-weeks` : undefined },
  ];
  const storeSearch = (r: StoreRow) => storeName(r.store);
  const rowSearch = (r: LaborOvertimeRow) => `${employeeName(r.name, r.employee_id)} ${storeName(r.store)} ${r.position ?? ""}`;

  return (
    <ReportDialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Overtime"
      category="people"
      stats={stats}
      tabs={[
        {
          key: "weeks",
          label: "By week",
          content: (
            <div className="space-y-4">
              <ReportBlock title={`Employee-weeks over ${t40}h`} description="Every loaded store together, by week number.">
                <ApexChart key={theme.key} options={options} series={series} type="bar" height={DIALOG_CHART_PX} />
              </ReportBlock>
              <PagedTable size="lg" rows={weeks} columns={weekColumns} rowKey={(w) => w.week_start} initialSort="week" initialDir="asc" />
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
              initialSort="o40"
              searchText={storeSearch}
              searchPlaceholder="Search stores…"
            />
          ),
        },
        {
          key: "employees",
          label: `Employee-weeks (${over40.length.toLocaleString()})`,
          content: (
            <div className="space-y-2">
              <StoreChecklist value={stores} onChange={setStores} />
              <PagedTable
                key={stores.join(",")}
                size="lg"
                rows={filtered}
                columns={columns}
                rowKey={rowKey}
                initialSort="hours"
                searchText={rowSearch}
                searchPlaceholder="Search employees…"
              />
            </div>
          ),
        },
      ]}
    />
  );
}

export function BrOvertime({ data }: { data: LaborReport }) {
  const [band, setBand] = useState<Band>("40");
  const [open, setOpen] = useState(false);
  const o = data.combined.overtime;
  const s = data.combined.summary;
  const t40 = o.over_40_hours_threshold;
  const t60 = o.over_60_hours_threshold;
  const columns = useRowColumns(t60);

  const rows = useMemo<LaborOvertimeRow[]>(() => (band === "40" ? o.over_40 : o.over_60) ?? [], [band, o.over_40, o.over_60]);
  const threshold = band === "40" ? t40 : t60;
  const hasAny = (o.over_40?.length ?? 0) > 0;

  return (
    <V1Card
      reportId="br-overtime"
      title="Overtime"
      category="people"
      period="R"
      span={2}
      height={ROW_CARD_HEIGHT}
      onExpand={hasAny ? () => setOpen(true) : undefined}
      headerControl={
        <V1Toggle<Band>
          className="ms-1.5"
          options={[
            { value: "40", label: `Over ${t40}` },
            { value: "60", label: `Over ${t60}` },
          ]}
          value={band}
          onChange={setBand}
        />
      }
    >
      <div className="flex h-full flex-col gap-1.5">
        <div className="grid shrink-0 grid-cols-2 gap-1">
          <V1Metric label={`Employee-weeks over ${t40}h`} value={fmtNumber(s.employee_weeks_over_40)} />
          <V1Metric
            label={`Employee-weeks over ${t60}h`}
            value={fmtNumber(s.employee_weeks_over_60)}
            accent={s.employee_weeks_over_60 > 0 ? ROSE : undefined}
          />
        </div>
        {rows.length === 0 ? (
          <V1Empty icon={Clock}>No one worked over {threshold} hours in a week</V1Empty>
        ) : (
          <div className="min-h-0 flex-1" onClick={(e) => e.stopPropagation()}>
            <PagedTable key={band} className="h-full" rows={rows} columns={columns} rowKey={rowKey} initialSort="hours" />
          </div>
        )}
      </div>

      {open && <OvertimeDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
