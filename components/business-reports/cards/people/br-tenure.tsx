"use client";

import { useMemo, useState } from "react";
import { Award, CalendarClock, Sprout, type LucideIcon } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric } from "@/components/dashboard-v1/v1-ui";
import { DASH, fmtNumber, fmtPercent, fmtTenure } from "@/components/labor/labor-format";
import { ApexChart, useChartTheme } from "@/components/business-reports/chart";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { share } from "@/components/business-reports/report-format";
import { StoreChecklist, inStores } from "@/components/business-reports/store-checklist";
import type { LaborBlock, LaborReport, LaborRosterRow } from "@/types/business-reports.types";
import { PEOPLE, StoreTag, TALL_ROW_HEIGHT, peopleBarOptions, safeDay } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Tenure — average tenure with a one-line headline, the bucket distribution,
 *  and the newest / longest-tenured employees side by side (with their store
 *  numbers). The dialog has the distribution per store and the full lists.
 * ────────────────────────────────────────────────────────────────────────── */

const CARD_CHART_PX = 150;
const DIALOG_CHART_PX = 320;
const LIST_ROWS = 5;
const ACTIVE = "active";

type TenurePerson = NonNullable<LaborBlock["tenure"]["newest_hires"]>[number];
type Distribution = LaborBlock["tenure"]["distribution"];

interface StoreRow {
  store: string;
  average: number | null;
  employees: number;
  counts: Record<string, number>;
}

function totalOf(distribution: Distribution): number {
  return distribution.reduce((s, d) => s + d.count, 0);
}

/** The bucket most employees fall in, with its share; null with nobody. */
function topBucket(distribution: Distribution): { bucket: string; pct: number } | null {
  const total = totalOf(distribution);
  if (total === 0) return null;
  const top = distribution.reduce((m, d) => (d.count > m.count ? d : m));
  return { bucket: top.bucket, pct: share(top.count, total) };
}

function TenureList({ title, icon: Icon, people }: { title: string; icon: LucideIcon; people: TenurePerson[] }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/50 bg-background/55 px-2 py-1">
      <p className="mb-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </p>
      {people.length === 0 ? (
        <p className="py-1 text-[11px] text-muted-foreground">{DASH}</p>
      ) : (
        <ul>
          {people.map((p) => (
            <li
              key={`${p.store}-${p.employee_id}`}
              className="flex items-center justify-between gap-2 border-b border-border/40 py-0.5 last:border-0"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[11px] font-medium">{p.name}</span>
                <StoreTag store={p.store} />
              </span>
              <span className="shrink-0 text-[10.5px] font-semibold tabular-nums">{fmtTenure(p.tenure_days)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TenureDialog({
  data,
  onClose,
  activeRoster,
}: {
  data: LaborReport;
  onClose: () => void;
  activeRoster: LaborRosterRow[];
}) {
  const theme = useChartTheme();
  const { storeName } = useReport();
  const [stores, setStores] = useState<string[]>([]);
  const t = data.combined.tenure;
  const distribution = t.distribution;
  const total = totalOf(distribution);
  const top = topBucket(distribution);
  const buckets = useMemo(() => distribution.map((d) => d.bucket), [distribution]);

  const options = useMemo(
    () => peopleBarOptions(theme, buckets, (v) => fmtNumber(v), false),
    [theme, buckets],
  );
  const series = useMemo(() => [{ name: "Employees", data: distribution.map((d) => d.count) }], [distribution]);

  const storeRows = useMemo<StoreRow[]>(
    () =>
      Object.entries(data.by_store).map(([store, block]) => ({
        store,
        average: block.tenure.average_tenure_days,
        employees: totalOf(block.tenure.distribution),
        counts: Object.fromEntries(block.tenure.distribution.map((d) => [d.bucket, d.count])),
      })),
    [data.by_store],
  );

  const storeColumns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      {
        key: "store",
        header: "Store",
        render: (r) => <span className="font-medium">{storeName(r.store)}</span>,
        sortValue: (r) => storeName(r.store),
      },
      { key: "avg", header: "Avg tenure", numeric: true, render: (r) => fmtTenure(r.average), sortValue: (r) => r.average },
      { key: "employees", header: "Active", numeric: true, render: (r) => fmtNumber(r.employees), sortValue: (r) => r.employees },
      ...buckets.map<PagedColumn<StoreRow>>((bucket) => ({
        key: `b-${bucket}`,
        header: bucket,
        numeric: true,
        render: (r) => {
          const count = r.counts[bucket] ?? 0;
          return (
            <span className={count === 0 ? "text-muted-foreground" : undefined}>
              {fmtNumber(count)}
              {count > 0 && (
                <span className="ms-1 text-[11px] text-muted-foreground">({fmtPercent(share(count, r.employees), 0)})</span>
              )}
            </span>
          );
        },
        sortValue: (r) => r.counts[bucket] ?? 0,
      })),
    ],
    [storeName, buckets],
  );

  const employees = useMemo(() => inStores(activeRoster, stores, (r) => r.store), [activeRoster, stores]);
  const employeeColumns = useMemo<PagedColumn<LaborRosterRow>[]>(
    () => [
      { key: "name", header: "Employee", render: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
      { key: "store", header: "Store", render: (r) => storeName(r.store), sortValue: (r) => storeName(r.store) },
      { key: "position", header: "Position", render: (r) => r.position ?? DASH, sortValue: (r) => r.position },
      { key: "hired", header: "Hired", render: (r) => safeDay(r.hire_date), sortValue: (r) => r.hire_date },
      {
        key: "tenure",
        header: "Tenure",
        numeric: true,
        render: (r) => <span className="font-semibold">{fmtTenure(r.tenure_days)}</span>,
        sortValue: (r) => r.tenure_days,
      },
    ],
    [storeName],
  );

  const newest = t.newest_hires?.[0];
  const longest = t.longest_tenured?.[0];
  const stats: ReportStat[] = [
    { label: "Average tenure", value: fmtTenure(t.average_tenure_days), sub: t.average_tenure_days === null ? undefined : `${fmtNumber(t.average_tenure_days)} days` },
    { label: "Active employees", value: fmtNumber(total) },
    { label: "Most common", value: top?.bucket ?? DASH, sub: top ? `${fmtPercent(top.pct, 0)} of active` : undefined },
    { label: "Newest hire", value: newest ? fmtTenure(newest.tenure_days) : DASH, sub: newest ? `${newest.name} · ${storeName(newest.store)}` : undefined },
    { label: "Longest tenured", value: longest ? fmtTenure(longest.tenure_days) : DASH, sub: longest ? `${longest.name} · ${storeName(longest.store)}` : undefined },
    { label: "Stores", value: fmtNumber(storeRows.length) },
  ];

  const employeeSearch = (r: LaborRosterRow) => `${r.name} ${storeName(r.store)} ${r.position ?? ""}`;
  const storeSearch = (r: StoreRow) => storeName(r.store);

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Tenure"
      category="people"
      stats={stats}
      tabs={[
        {
          key: "overview",
          label: "Overview",
          content: (
            <div className="space-y-4">
              <ReportBlock title="Distribution" description="Active employees by tenure, every loaded store together.">
                {total === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No tenure data</p>
                ) : (
                  <ApexChart key={theme.key} options={options} series={series} type="bar" height={DIALOG_CHART_PX} />
                )}
              </ReportBlock>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DialogPeopleList title="Newest" icon={Sprout} people={t.newest_hires ?? []} />
                <DialogPeopleList title="Longest tenured" icon={Award} people={t.longest_tenured ?? []} />
              </div>
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
              initialSort="avg"
              searchText={storeSearch}
              searchPlaceholder="Search stores…"
            />
          ),
        },
        {
          key: "employees",
          label: `Employees (${activeRoster.length.toLocaleString()})`,
          content: (
            <div className="space-y-2">
              <StoreChecklist value={stores} onChange={setStores} />
              {employees.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No active employees on the roster</p>
              ) : (
                <PagedTable
                  key={stores.join(",")}
                  size="lg"
                  rows={employees}
                  columns={employeeColumns}
                  rowKey={(r) => `${r.store}-${r.employee_id}`}
                  initialSort="tenure"
                  searchText={employeeSearch}
                  searchPlaceholder="Search employees…"
                />
              )}
            </div>
          ),
        },
      ]}
    />
  );
}

function DialogPeopleList({ title, icon: Icon, people }: { title: string; icon: LucideIcon; people: TenurePerson[] }) {
  const { storeName } = useReport();
  return (
    <ReportBlock title={title}>
      {people.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{DASH}</p>
      ) : (
        <ul>
          {people.map((p) => (
            <li
              key={`${p.store}-${p.employee_id}`}
              className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5 last:border-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${PEOPLE.text}`} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{storeName(p.store)}</span>
                </span>
              </span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums">{fmtTenure(p.tenure_days)}</span>
            </li>
          ))}
        </ul>
      )}
    </ReportBlock>
  );
}

export function BrTenure({ data }: { data: LaborReport }) {
  const theme = useChartTheme();
  const [open, setOpen] = useState(false);
  const t = data.combined.tenure;
  const distribution = t.distribution;
  const total = totalOf(distribution);
  const top = topBucket(distribution);

  const activeRoster = useMemo(
    () => (data.combined.roster ?? []).filter((r) => r.status === ACTIVE),
    [data.combined.roster],
  );

  const options = useMemo(
    () => peopleBarOptions(theme, distribution.map((d) => d.bucket), (v) => fmtNumber(v), false),
    [theme, distribution],
  );
  const series = useMemo(() => [{ name: "Employees", data: distribution.map((d) => d.count) }], [distribution]);
  const newest = (t.newest_hires ?? []).slice(0, LIST_ROWS);
  const longest = (t.longest_tenured ?? []).slice(0, LIST_ROWS);

  return (
    <V1Card
      reportId="br-tenure"
      title="Tenure"
      category="people"
      period="R"
      span={2}
      height={TALL_ROW_HEIGHT}
      headerNote={total > 0 ? `${fmtNumber(total)} active` : undefined}
      onExpand={() => setOpen(true)}
    >
      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-1">
          <V1Metric
            label="Average Tenure"
            value={fmtTenure(t.average_tenure_days)}
            sub={t.average_tenure_days === null ? "no active employees" : `${fmtNumber(t.average_tenure_days)} days`}
            size="lg"
          />
          <V1Metric
            label="Most Common"
            value={top?.bucket ?? DASH}
            sub={top ? `${fmtPercent(top.pct, 0)} of ${fmtNumber(total)} active` : undefined}
          />
          <V1Metric
            label="Longest Tenured"
            value={longest[0] ? fmtTenure(longest[0].tenure_days) : DASH}
            sub={longest[0]?.name}
          />
        </div>
        {total > 0 ? (
          <ApexChart key={theme.key} options={options} series={series} type="bar" height={CARD_CHART_PX} />
        ) : (
          <div className="h-16">
            <V1Empty icon={CalendarClock}>No tenure data</V1Empty>
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <TenureList title="Newest" icon={Sprout} people={newest} />
          <TenureList title="Longest Tenured" icon={Award} people={longest} />
        </div>
      </div>

      {open && <TenureDialog data={data} activeRoster={activeRoster} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
