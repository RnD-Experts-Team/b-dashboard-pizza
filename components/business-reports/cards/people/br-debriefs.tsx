"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1MetricGrid, V1StackedBar, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { DASH, fmtNumber } from "@/components/labor/labor-format";
import { ApexChart, useChartTheme } from "@/components/business-reports/chart";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import type { DebriefTypeCount, DebriefsSection } from "@/types/business-reports.types";
import { ROW_CARD_HEIGHT, TWO_DP, employeeName, peopleLineOptions, safeDay } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Debriefs — the Employee report's debrief summary over the range for every
 *  loaded store: totals, type mix, the weekly line, and (dialog) every
 *  event, employee and store.
 * ────────────────────────────────────────────────────────────────────────── */

/** Distinct hue per type (same set as the Employee report's breakdown). */
const SEGMENT_COLORS = ["#8b5cf6", "#f43f5e", "#0ea5e9", "#f59e0b", "#10b981", "#71717a"];
const CHART_PX = 120;
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

function DebriefTables({ data }: { data: DebriefsSection }) {
  const { storeName } = useReport();

  const events = useMemo(() => [...data.events].sort((a, b) => b.date.localeCompare(a.date)), [data.events]);
  const stores = useMemo<StoreRow[]>(
    () => Object.entries(data.by_store).map(([store, s]) => ({ store, ...s })),
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
          <Badge variant="outline" className="h-4 px-1 text-[9px]">
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
          <Badge variant={e.active ? "secondary" : "outline"} className="h-4 px-1 text-[9px]">
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

  return (
    <Tabs defaultValue="events" className="space-y-3">
      <TabsList>
        <TabsTrigger value="events">Events ({events.length.toLocaleString()})</TabsTrigger>
        <TabsTrigger value="employees">Employees ({data.employees.length.toLocaleString()})</TabsTrigger>
        <TabsTrigger value="stores">Stores ({stores.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="events">
        <PagedTable rows={events} columns={eventColumns} rowKey={(e) => e.debrief_id} initialSort="date" />
      </TabsContent>
      <TabsContent value="employees">
        <PagedTable rows={data.employees} columns={employeeColumns} rowKey={(e) => `${e.store}-${e.employee_id}`} initialSort="total" />
      </TabsContent>
      <TabsContent value="stores">
        <PagedTable rows={stores} columns={storeColumns} rowKey={(s) => s.store} initialSort="total" />
      </TabsContent>
    </Tabs>
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
    () => peopleLineOptions(theme, data.weeks.map((w) => safeDay(w.week_start)), (v) => fmtNumber(v)),
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
      span={2}
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

      {open && (
        <WbrDetailDialog open={open} onOpenChange={setOpen} title="Debriefs" badgeText={`${fmtNumber(s.total_debriefs)} logged`} className="sm:max-w-6xl">
          <DebriefTables data={data} />
        </WbrDetailDialog>
      )}
    </V1Card>
  );
}
