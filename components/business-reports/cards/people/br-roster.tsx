"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Search, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog, DetailField } from "@/components/dspr/wbr-detail-dialog";
import { DASH, fmtColumnValue, fmtDecimalString, fmtTenure } from "@/components/labor/labor-format";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import type { LaborReport, LaborRosterRow } from "@/types/business-reports.types";
import { StoreTag, safeDay } from "./br-people-kit";
import { compareText } from "../../report-format";

/* ──────────────────────────────────────────────────────────────────────────
 *  Employee Roster — everyone on the loaded stores' rosters over the range,
 *  with their aggregated metrics. Filter by status / store / name; a row
 *  opens every metric; the icon opens the employee profile.
 * ────────────────────────────────────────────────────────────────────────── */

const ALL = "__all__";
const CARD_HEIGHT = 420;

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

function EmployeeDetail({ row, profileHref }: { row: LaborRosterRow; profileHref: string }) {
  const { storeName } = useReport();
  const entries = Object.entries(row.metrics);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <DetailField label="Store" value={storeName(row.store)} />
          <DetailField label="Position" value={row.position ?? DASH} />
          <DetailField label="Status" value={<StatusBadge status={row.status} />} />
          <DetailField label="Hired" value={safeDay(row.hire_date)} />
          <DetailField label="Tenure" value={fmtTenure(row.tenure_days)} />
          <DetailField label="Base pay" value={fmtDecimalString(row.base_pay)} />
          <DetailField label="Performance pay" value={fmtDecimalString(row.performance_pay)} />
        </div>
        <Button asChild variant="outline" size="sm" className="h-7 text-xs">
          <Link href={profileHref}>
            <UserRound className="h-3.5 w-3.5" />
            View profile
          </Link>
        </Button>
      </div>
      <div>
        <V1SubLabel className="mb-1">Metrics over the range ({entries.length})</V1SubLabel>
        {entries.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No metrics recorded for this employee in this range.</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map(([key, m]) => (
              <div key={key} className="flex items-center justify-between gap-2 border-b border-border/30 py-1">
                <span className="min-w-0 truncate text-[11px] text-muted-foreground">{m.label}</span>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums">
                  {fmtColumnValue(key, m.sum)}
                  {m.avg !== null && m.avg !== m.sum && (
                    <span className="ms-1 font-normal text-muted-foreground">(avg {fmtColumnValue(key, m.avg)})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="h-7! w-36 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value={ALL} className="text-xs">
          {allLabel}
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs capitalize">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function BrRoster({ data }: { data: LaborReport }) {
  const { storeName } = useReport();
  const profileHref = useProfileHref();
  const roster = useMemo(() => data.combined.roster ?? [], [data.combined.roster]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ALL);
  const [store, setStore] = useState(ALL);
  const [selected, setSelected] = useState<LaborRosterRow | null>(null);

  const statusOptions = useMemo(
    () => [...new Set(roster.map((r) => r.status))].sort().map((s) => ({ value: s, label: s })),
    [roster],
  );
  const storeOptions = useMemo(
    () =>
      [...new Set(roster.map((r) => r.store))]
        .map((s) => ({ value: s, label: storeName(s) }))
        .sort((a, b) => compareText(a.label, b.label)),
    [roster, storeName],
  );
  const hasPerformance = useMemo(() => roster.some((r) => metricAvg(r, "performance_score") !== null), [roster]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q)) &&
        (status === ALL || r.status === status) &&
        (store === ALL || r.store === store),
    );
  }, [roster, query, status, store]);

  const columns = useMemo<PagedColumn<LaborRosterRow>[]>(() => {
    const base: PagedColumn<LaborRosterRow>[] = [
      { key: "name", header: "Employee", render: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
      { key: "store", header: "Store", render: (r) => <StoreTag className="text-[11px]">{storeName(r.store)}</StoreTag>, sortValue: (r) => storeName(r.store) },
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

  const filterKey = `${query}|${status}|${store}`;

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
            <FilterSelect value={status} onChange={setStatus} allLabel="All statuses" options={statusOptions} />
            {storeOptions.length > 1 && (
              <FilterSelect value={store} onChange={setStore} allLabel="All stores" options={storeOptions} />
            )}
            <div className="relative w-full max-w-56 sm:w-48">
              <Search className="absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name…" className="h-7 ps-7 text-xs" />
            </div>
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
        <WbrDetailDialog
          open={selected !== null}
          onOpenChange={(o) => {
            if (!o) setSelected(null);
          }}
          title={selected.name}
          badgeText={storeName(selected.store)}
          className="sm:max-w-3xl"
        >
          <EmployeeDetail row={selected} profileHref={profileHref(selected)} />
        </WbrDetailDialog>
      )}
    </V1Card>
  );
}
