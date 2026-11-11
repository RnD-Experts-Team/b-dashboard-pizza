"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Search, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import { DASH, fmtColumnValue, fmtDecimalString, fmtTenure } from "@/components/labor/labor-format";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { StoreChecklist, inStores } from "@/components/business-reports/store-checklist";
import type { LaborReport, LaborRosterRow } from "@/types/business-reports.types";
import { ActiveToggle, NOT_HIRING_COLUMNS, StoreTag, matchesActive, safeDay, type ActiveFilter } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Employee Roster — everyone on the loaded stores' rosters over the range,
 *  with their aggregated metrics. Filter by status (Active by default) /
 *  stores (checklist) / name; a row opens every metric; the icon opens the
 *  employee profile.
 * ────────────────────────────────────────────────────────────────────────── */

const CARD_HEIGHT = 420;
const ACTIVE = "active";

function metricSum(row: LaborRosterRow, key: string): number | null {
  return row.metrics[key]?.sum ?? null;
}

function metricAvg(row: LaborRosterRow, key: string): number | null {
  return row.metrics[key]?.avg ?? null;
}

function useProfileHref() {
  const { locale } = useParams<{ locale: string }>();
  return useCallback(
    (row: LaborRosterRow) =>
      `/${locale}/dashboard/employee-profile?storeId=${encodeURIComponent(row.store)}&employeeId=${row.employee_id}`,
    [locale],
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "active" ? "secondary" : "outline"} className="h-4 px-1 text-[9px] capitalize">
      {status}
    </Badge>
  );
}

function EmployeeDetail({
  row,
  profileHref,
  onClose,
}: {
  row: LaborRosterRow;
  profileHref: string;
  onClose: () => void;
}) {
  const { storeName } = useReport();
  const entries = Object.entries(row.metrics).filter(([key]) => !NOT_HIRING_COLUMNS.has(key));
  const stats: ReportStat[] = [
    { label: "Status", value: <span className="capitalize">{row.status}</span>, sub: row.position ?? undefined },
    { label: "Tenure", value: fmtTenure(row.tenure_days), sub: `hired ${safeDay(row.hire_date)}` },
    { label: "Base pay", value: fmtDecimalString(row.base_pay) },
    { label: "Performance pay", value: fmtDecimalString(row.performance_pay) },
    { label: "Hours", value: fmtColumnValue("total_hours", metricSum(row, "total_hours")) },
    { label: "Gross pay", value: fmtColumnValue("gross_pay", metricSum(row, "gross_pay")) },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={row.name}
      category="people"
      subtitle={`${storeName(row.store)} · ${row.position ?? "No position"}`}
      stats={stats}
    >
      <ReportBlock
        title={`Metrics over the range (${entries.length})`}
        description="Sum over the range; the average per reading in brackets where it differs."
        action={
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link href={profileHref}>
              <UserRound className="h-3.5 w-3.5" />
              View profile
            </Link>
          </Button>
        }
      >
        {entries.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No metrics recorded for this employee in this range.</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map(([key, m]) => (
              <div key={key} className="flex items-center justify-between gap-2 border-b border-border/40 py-1.5">
                <span className="min-w-0 truncate text-[13px] text-muted-foreground">{m.label}</span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                  {fmtColumnValue(key, m.sum)}
                  {m.avg !== null && m.avg !== m.sum && (
                    <span className="ms-1 font-normal text-muted-foreground">(avg {fmtColumnValue(key, m.avg)})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </ReportBlock>
    </ReportDialog>
  );
}

export function BrRoster({ data }: { data: LaborReport }) {
  const { storeName } = useReport();
  const profileHref = useProfileHref();
  const roster = useMemo(() => data.combined.roster ?? [], [data.combined.roster]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ActiveFilter>("active");
  const [stores, setStores] = useState<string[]>([]);
  const [selected, setSelected] = useState<LaborRosterRow | null>(null);

  const rosterStores = useMemo(() => [...new Set(roster.map((r) => r.store))].sort(), [roster]);
  const hasPerformance = useMemo(() => roster.some((r) => metricAvg(r, "performance_score") !== null), [roster]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inStores(roster, stores, (r) => r.store).filter(
      (r) => (!q || r.name.toLowerCase().includes(q)) && matchesActive(r.status === ACTIVE, status),
    );
  }, [roster, query, status, stores]);

  const columns = useMemo<PagedColumn<LaborRosterRow>[]>(() => {
    const base: PagedColumn<LaborRosterRow>[] = [
      { key: "name", header: "Employee", render: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
      { key: "store", header: "Store", render: (r) => <StoreTag store={r.store} className="text-[11px]" />, sortValue: (r) => storeName(r.store) },
      { key: "position", header: "Position", render: (r) => <span className="text-muted-foreground">{r.position ?? DASH}</span>, sortValue: (r) => r.position },
      { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} />, sortValue: (r) => r.status },
      { key: "tenure", header: "Tenure", numeric: true, render: (r) => fmtTenure(r.tenure_days), sortValue: (r) => r.tenure_days },
      {
        key: "base_pay",
        header: "Base Pay",
        numeric: true,
        render: (r) => fmtDecimalString(r.base_pay),
        sortValue: (r) => (r.base_pay === null || r.base_pay === "" ? null : Number(r.base_pay)),
      },
      { key: "hours", header: "Hours", numeric: true, render: (r) => fmtColumnValue("total_hours", metricSum(r, "total_hours")), sortValue: (r) => metricSum(r, "total_hours") },
      { key: "gross", header: "Gross Pay", numeric: true, render: (r) => fmtColumnValue("gross_pay", metricSum(r, "gross_pay")), sortValue: (r) => metricSum(r, "gross_pay") },
    ];
    const performance: PagedColumn<LaborRosterRow>[] = hasPerformance
      ? [
          {
            key: "performance",
            header: "Perf. Avg",
            numeric: true,
            render: (r) => fmtColumnValue("performance_score", metricAvg(r, "performance_score")),
            sortValue: (r) => metricAvg(r, "performance_score"),
          },
        ]
      : [];
    const profile: PagedColumn<LaborRosterRow> = {
      key: "profile",
      header: <span className="sr-only">Profile</span>,
      render: (r) => (
        <Button asChild variant="ghost" size="icon" className="h-5 w-5" title="View profile">
          <Link href={profileHref(r)} onClick={(e) => e.stopPropagation()}>
            <UserRound className="h-3 w-3" />
            <span className="sr-only">View profile</span>
          </Link>
        </Button>
      ),
    };
    return [...base, ...performance, profile];
  }, [storeName, hasPerformance, profileHref]);

  const filterKey = `${query}|${status}|${stores.join(",")}`;

  return (
    <V1Card
      reportId="br-roster"
      title="Employee Roster"
      category="people"
      period="R"
      span={4}
      height={CARD_HEIGHT}
      headerNote={roster.length > 0 ? `${roster.length.toLocaleString()} employees` : undefined}
    >
      {roster.length === 0 ? (
        <V1Empty icon={Users}>No employees on the loaded stores&apos; rosters</V1Empty>
      ) : (
        <div className="flex h-full flex-col gap-1.5">
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <ActiveToggle value={status} onChange={setStatus} />
            {rosterStores.length > 1 && <StoreChecklist value={stores} onChange={setStores} stores={rosterStores} />}
            <div className="relative w-full max-w-56 sm:w-48" onClick={(e) => e.stopPropagation()}>
              <Search className="absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name…" className="h-8 ps-7 text-xs" />
            </div>
            <span className="ms-auto text-[10px] text-muted-foreground">{filtered.length.toLocaleString()} shown</span>
          </div>
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-muted-foreground">No employees match the current filters</p>
          ) : (
            <PagedTable
              key={filterKey}
              className="min-h-0 flex-1"
              rows={filtered}
              columns={columns}
              rowKey={(r) => `${r.store}-${r.employee_id}`}
              initialSort="name"
              initialDir="asc"
              onRowClick={setSelected}
              footerNote="click a row for every metric"
            />
          )}
        </div>
      )}

      {selected && (
        <EmployeeDetail row={selected} profileHref={profileHref(selected)} onClose={() => setSelected(null)} />
      )}
    </V1Card>
  );
}
