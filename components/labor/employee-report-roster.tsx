"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { V1Empty, V1_TBL, V1_TD, V1_TH, V1_NUM } from "@/components/dashboard-v1/v1-ui";
import { cn } from "@/lib/utils";
import type { EmployeeReportEmployee } from "@/types/employee-report.types";
import { LaborCard } from "./labor-chart";
import { fmtNumber } from "./labor-format";
import { NEUTRAL_BADGE } from "./labor-badges";
import { useTableSort } from "./use-table-sort";

type SortKey = "name" | "active" | "debriefs";

const ALL = "__all__";
const PAGE_SIZE = 25;

function SortHeader({
  label,
  sortKey,
  activeKey,
  onSort,
  numeric,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  onSort: (k: SortKey) => void;
  numeric?: boolean;
}) {
  return (
    <th className={cn(V1_TH, numeric && "text-right")}>
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

function EmployeeRow({ employee, colSpan }: { employee: EmployeeReportEmployee; colSpan: number }) {
  const [open, setOpen] = useState(false);
  const debriefs = employee.debriefs_this_week;

  return (
    <>
      <tr className="cursor-pointer hover:bg-muted/40" onClick={() => setOpen((o) => !o)}>
        <td className={cn(V1_TD, "font-medium")}>
          <span className="flex items-center gap-1.5">
            <ChevronDown
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
            <span className="truncate">{employee.name}</span>
          </span>
        </td>
        <td className={V1_TD}>
          <Badge className={cn("h-4 px-1 text-[9px] capitalize", NEUTRAL_BADGE)}>
            {employee.active ? "Active" : "Inactive"}
          </Badge>
        </td>
        <td className={cn(V1_TD, V1_NUM, "font-semibold")}>
          {fmtNumber(debriefs.total_count)}
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={colSpan} className="border-b border-border/40 bg-muted/20 px-3 py-2">
            {debriefs.by_type.every((e) => e.count === 0) ? (
              <p className="text-[11px] text-muted-foreground">
                No debriefs recorded for this employee this week
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
                {debriefs.by_type.map((e) => (
                  <div
                    key={e.type?.id ?? "untyped"}
                    className="flex items-center justify-between gap-2 border-b border-border/30 py-0.5"
                  >
                    <span className="min-w-0 truncate text-[10px] text-muted-foreground">
                      {e.type?.label ?? "Untyped"}
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold tabular-nums">
                      {fmtNumber(e.count)}
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

export function EmployeeReportRoster({
  employees,
}: {
  employees: EmployeeReportEmployee[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false;
      if (status === "active" && !e.active) return false;
      if (status === "inactive" && e.active) return false;
      return true;
    });
  }, [employees, query, status]);

  const { sorted, sortKey, toggleSort } = useTableSort<EmployeeReportEmployee, SortKey>(
    filtered,
    {
      name: (e) => e.name,
      active: (e) => (e.active ? 1 : 0),
      debriefs: (e) => e.debriefs_this_week.total_count,
    },
    "name",
    "asc",
  );

  // Client-side pagination — this endpoint returns the full roster in one
  // response, so paging happens after filter+sort rather than as a request param.
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetToFirstPage = () => setPage(1);

  const COL_COUNT = 3;

  return (
    <LaborCard
      title="Employee Debrief Roster"
      icon={Users}
      action={
        employees.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                resetToFirstPage();
              }}
            >
              <SelectTrigger size="sm" className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetToFirstPage();
                }}
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
          <table className={cn(V1_TBL, "min-w-[420px]")}>
            <thead>
              <tr>
                <SortHeader label="Employee" sortKey="name" activeKey={sortKey} onSort={toggleSort} />
                <SortHeader label="Status" sortKey="active" activeKey={sortKey} onSort={toggleSort} />
                <SortHeader
                  label="Debriefs"
                  sortKey="debriefs"
                  activeKey={sortKey}
                  onSort={toggleSort}
                  numeric
                />
              </tr>
            </thead>
            <tbody>
              {paginated.map((e) => (
                <EmployeeRow key={e.employee_id} employee={e} colSpan={COL_COUNT} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length} · click a
            row for the type breakdown
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <span className="me-1 text-[10px] text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                onClick={() => setPage(1)}
                disabled={currentPage <= 1}
              >
                <span className="sr-only">First page</span>
                <ChevronsLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <span className="sr-only">Previous page</span>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                <span className="sr-only">Next page</span>
                <ChevronRight className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                onClick={() => setPage(totalPages)}
                disabled={currentPage >= totalPages}
              >
                <span className="sr-only">Last page</span>
                <ChevronsRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </LaborCard>
  );
}
