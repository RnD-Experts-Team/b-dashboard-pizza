"use client";

import { useMemo, useState } from "react";
import { Users, Search, ArrowUpDown, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  V1Empty,
  V1_TBL,
  V1_TD,
  V1_TH,
  V1_NUM,
} from "@/components/dashboard-v1/v1-ui";
import { cn } from "@/lib/utils";
import type { LaborEmployee } from "@/types/labor.types";
import { LaborCard } from "./labor-chart";
import {
  DASH,
  fmtColumnValue,
  fmtDecimalString,
  fmtNumber,
  fmtTenure,
} from "./labor-format";
import { useTableSort } from "./use-table-sort";
import type { EmployeeBadge } from "./labor-badges";
import { BADGE_STYLES } from "./labor-badges";

type SortKey = "name" | "position" | "status" | "tenure_days" | "base_pay" | "hours";

const ALL = "__all__";

function SortHeader({
  label,
  sortKey,
  activeKey,
  onSort,
  numeric,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  onSort: (k: SortKey) => void;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <th className={cn(V1_TH, numeric && "text-right", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-0.5 hover:text-foreground",
          activeKey === sortKey && "text-foreground",
        )}
      >
        {label}
        <ArrowUpDown className="h-2.5 w-2.5" />
      </button>
    </th>
  );
}

function EmployeeRow({
  employee,
  badges,
  colSpan,
}: {
  employee: LaborEmployee;
  badges: EmployeeBadge[];
  colSpan: number;
}) {
  const [open, setOpen] = useState(false);
  const metricEntries = Object.entries(employee.metrics);
  const hours = employee.metrics["total_hours"]?.sum ?? null;

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-muted/40"
        onClick={() => setOpen((o) => !o)}
      >
        <td className={cn(V1_TD, "font-medium")}>
          <span className="flex items-center gap-1.5">
            <ChevronDown
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
            <span className="truncate">{employee.name}</span>
            {badges.map((b) => (
              <Badge
                key={b}
                className={cn("h-4 shrink-0 px-1 text-[9px] font-semibold", BADGE_STYLES[b])}
              >
                {b}
              </Badge>
            ))}
          </span>
        </td>
        <td className={cn(V1_TD, "text-muted-foreground")}>
          {employee.position ?? DASH}
        </td>
        <td className={V1_TD}>
          <Badge
            variant={employee.status === "active" ? "secondary" : "outline"}
            className="h-4 px-1 text-[9px] capitalize"
          >
            {employee.status}
          </Badge>
        </td>
        <td className={cn(V1_TD, V1_NUM)}>{fmtTenure(employee.tenure_days)}</td>
        <td className={cn(V1_TD, V1_NUM)}>{fmtDecimalString(employee.base_pay)}</td>
        <td className={cn(V1_TD, V1_NUM)}>
          {fmtColumnValue("total_hours", hours)}
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={colSpan} className="border-b border-border/40 bg-muted/20 px-3 py-2">
            <div className="mb-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground">
              <span>
                Hired:{" "}
                <span className="font-medium text-foreground">
                  {employee.hire_date ?? DASH}
                </span>
              </span>
              <span>
                Tenure:{" "}
                <span className="font-medium text-foreground">
                  {employee.tenure_days === null
                    ? DASH
                    : `${fmtNumber(employee.tenure_days)} days`}
                </span>
              </span>
              <span>
                Performance pay:{" "}
                <span className="font-medium text-foreground">
                  {fmtDecimalString(employee.performance_pay)}
                </span>
              </span>
            </div>

            {metricEntries.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No metrics recorded for this employee this week
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-4">
                {metricEntries.map(([key, m]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 border-b border-border/30 py-0.5"
                  >
                    <span className="min-w-0 truncate text-[10px] text-muted-foreground">
                      {m.label}
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold tabular-nums">
                      {fmtColumnValue(key, m.sum)}
                      {m.avg !== null && m.avg !== m.sum && (
                        <span className="ms-1 font-normal text-muted-foreground">
                          (avg {fmtColumnValue(key, m.avg)})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function LaborRoster({
  employees,
  badgesByEmployee,
}: {
  employees: LaborEmployee[];
  badgesByEmployee: Map<number, EmployeeBadge[]>;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [position, setPosition] = useState<string>(ALL);

  const positions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.position) set.add(e.position);
    });
    return [...set].sort();
  }, [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false;
      if (status !== ALL && e.status !== status) return false;
      if (position !== ALL && e.position !== position) return false;
      return true;
    });
  }, [employees, query, status, position]);

  const { sorted, sortKey, toggleSort } = useTableSort<LaborEmployee, SortKey>(
    filtered,
    {
      name: (e) => e.name,
      position: (e) => e.position,
      status: (e) => e.status,
      tenure_days: (e) => e.tenure_days,
      base_pay: (e) => (e.base_pay === null ? null : Number(e.base_pay)),
      hours: (e) => e.metrics["total_hours"]?.sum ?? null,
    },
    "name",
    "asc",
  );

  const COL_COUNT = 6;

  return (
    <LaborCard
      title="Employee Roster"
      icon={Users}
      action={
        employees.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger size="sm" className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {positions.length > 0 && (
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger size="sm" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All positions</SelectItem>
                  {positions.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="relative">
              <Search className="absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name…"
                className="h-7 w-40 ps-7 text-xs"
              />
            </div>
          </div>
        ) : undefined
      }
    >
      {employees.length === 0 ? (
        <V1Empty icon={Users}>No employees for this store this week</V1Empty>
      ) : sorted.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-muted-foreground">
          No employees match the current filters
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border/50">
          <table className={cn(V1_TBL, "min-w-[640px]")}>
            <thead>
              <tr>
                <SortHeader
                  label="Employee"
                  sortKey="name"
                  activeKey={sortKey}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Position"
                  sortKey="position"
                  activeKey={sortKey}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Status"
                  sortKey="status"
                  activeKey={sortKey}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Tenure"
                  sortKey="tenure_days"
                  activeKey={sortKey}
                  onSort={toggleSort}
                  numeric
                />
                <SortHeader
                  label="Base Pay"
                  sortKey="base_pay"
                  activeKey={sortKey}
                  onSort={toggleSort}
                  numeric
                />
                <SortHeader
                  label="Hours"
                  sortKey="hours"
                  activeKey={sortKey}
                  onSort={toggleSort}
                  numeric
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <EmployeeRow
                  key={e.employee_id}
                  employee={e}
                  badges={badgesByEmployee.get(e.employee_id) ?? []}
                  colSpan={COL_COUNT}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Showing {sorted.length} of {employees.length} · click a row for full
        metrics
      </p>
    </LaborCard>
  );
}
