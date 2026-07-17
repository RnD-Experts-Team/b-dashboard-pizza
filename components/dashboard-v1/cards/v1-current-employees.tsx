"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { cn } from "@/lib/utils";
import type { ManagerDashboardEmployee, ManagerDashboardStoreData } from "@/types/employee.types";
import { WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { Button } from "@/components/ui/button";
import {
  V1Empty,
  V1Toggle,
  V1_TBL,
  V1_TH,
  V1_TD,
  V1_NUM,
} from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1CurrentEmployeesCard — active employees for the selected week (people).
 *  Data derivation mirrors components/dspr/current-employees-table.tsx:
 *  rows = managerDashboard.data.employees; per-employee metric values are
 *  looked up by label from employee.metrics[].value_numeric (fallback .value).
 * ────────────────────────────────────────────────────────────────────────── */

const METRIC_COLUMNS = [
  "Performance Score",
  "Gross Pay",
  "Total Hours",
  "Hourly Pay",
];

function formatEmployeeName(employee: ManagerDashboardEmployee): string {
  return [employee.name.first, employee.name.middle, employee.name.last]
    .filter(Boolean)
    .join(" ");
}

function formatMetricDisplay(label: string, rawValue: string | number): string {
  const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (!Number.isFinite(numericValue)) return "-";

  if (label.toLowerCase() === "performance score") {
    return `${Math.round(numericValue * 100)}%`;
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function getEmployeeMetricDisplay(
  employee: ManagerDashboardEmployee,
  label: string,
  week: "current" | "past",
): string {
  const metrics = week === "current" ? employee.current_metrics : employee.metrics;
  const metric = (metrics ?? []).find((item) => item.label === label);
  if (!metric) return "-";
  return formatMetricDisplay(label, metric.value_numeric ?? metric.value);
}

function formatStatus(status?: string | null): string {
  if (!status) return "-";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateRange(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  try {
    return `${format(parseISO(start), "MMM d")} – ${format(parseISO(end), "MMM d, yyyy")}`;
  } catch {
    return null;
  }
}

export function V1CurrentEmployeesCard({
  managerDashboard,
  span,
  className,
}: {
  managerDashboard: {
    data?: ManagerDashboardStoreData | null;
    isLoading?: boolean;
  };
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const router = useRouter();
  const { selectedStore } = useSelectedStoreStore();
  const { data, isLoading } = managerDashboard;
  const [week, setWeek] = useState<"current" | "past">("current");

  if (isLoading && !data) return <WbrCardSkeleton className={className} />;

  const rows: ManagerDashboardEmployee[] = data?.employees ?? [];
  const dateRange = data
    ? week === "current"
      ? formatDateRange(data.week_start, data.week_end)
      : formatDateRange(data.previous_week_start, data.previous_week_end)
    : null;

  const pageLink = (
    <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" asChild>
      <Link href={`/${locale}/dashboard/employees`}>
        <ExternalLink className="h-3 w-3" />
      </Link>
    </Button>
  );

  return (
    <V1Card
      title="Current Employees"
      category="people"
      period="D"
      span={span}
      className={className}
      bodyClassName="px-0"
      headerNote={
        rows.length > 0 ? (
          <span>
            {rows.length} active{dateRange ? ` · ${dateRange}` : ""}
          </span>
        ) : undefined
      }
      headerControl={
        <div className="flex items-center gap-1">
          <V1Toggle
            options={[
              { value: "current", label: "Current" },
              { value: "past", label: "Past" },
            ]}
            value={week}
            onChange={setWeek}
          />
          {pageLink}
        </div>
      }
    >
      {rows.length === 0 ? (
        <V1Empty>No active employees found</V1Empty>
      ) : (
        <table className={V1_TBL}>
          <thead>
            <tr>
              <th className={V1_TH}>Name</th>
              <th className={V1_TH}>Status</th>
              {METRIC_COLUMNS.map((label) => (
                <th key={label} className={cn(V1_TH, V1_NUM)}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((employee) => (
              <tr
                key={employee.employee_id}
                className={cn(
                  "cursor-pointer hover:bg-primary/5 transition-colors",
                  isLoading && "opacity-60",
                )}
                onClick={() =>
                  selectedStore &&
                  router.push(
                    `/${locale}/dashboard/employee-profile?storeId=${encodeURIComponent(selectedStore.storeId)}&employeeId=${employee.employee_id}`,
                  )
                }
              >
                <td className={cn(V1_TD, "font-medium")}>
                  {formatEmployeeName(employee)}
                </td>
                <td className={cn(V1_TD, "text-muted-foreground")}>
                  {formatStatus(employee.status)}
                </td>
                {METRIC_COLUMNS.map((label) => (
                  <td key={label} className={cn(V1_TD, V1_NUM)}>
                    {getEmployeeMetricDisplay(employee, label, week)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </V1Card>
  );
}
