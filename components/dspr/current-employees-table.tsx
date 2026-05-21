"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { CanAccessParams } from "@/lib/auth/can-access";
import { useAuth } from "@/lib/auth/use-auth";
import type { UseManagerDashboardResult } from "@/lib/hooks/use-manager-dashboard";
import type { ManagerDashboardEmployee } from "@/types/employee.types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurrentEmployeesTableProps {
  requirements?: CanAccessParams[];
  managerDashboard: UseManagerDashboardResult;
  className?: string;
}

function CurrentEmployeesSkeleton() {
  return (
    <Card className="py-1.5 gap-0">
      <CardHeader className="pb-1 px-3">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-3 w-40 mt-0.5" />
      </CardHeader>
      <CardContent className="px-3">
        <div className="rounded-md border p-2">
          <Table>
            <TableHeader>
              <TableRow>
                {["Name", "Position", "Base Pay"].map((heading) => (
                  <TableHead key={heading} className="text-[9px] uppercase tracking-[0.02em]">
                    {heading}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 4 }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-3 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function formatEmployeeName(employee: ManagerDashboardEmployee): string {
  return [employee.name.first, employee.name.middle, employee.name.last]
    .filter(Boolean)
    .join(" ");
}

export function CurrentEmployeesTable({
  requirements,
  managerDashboard,
  className,
}: CurrentEmployeesTableProps) {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { canAccessRoute } = useAuth();
  const { selectedStore } = useSelectedStoreStore();

  const { data, isLoading, error, refetch } = managerDashboard;

  const canViewEmployees =
    requirements && requirements.length > 0
      ? requirements.some((requirement) => canAccessRoute(requirement))
      : true;

  if (isLoading && !data) {
    return <CurrentEmployeesSkeleton />;
  }

  if (!selectedStore) {
    return null;
  }

  if (error && !data) {
    return (
      <Card className={cn("py-1.5 gap-0", className)}>
        <CardHeader className="pb-1 px-3">
          <div className="flex items-center gap-1">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-[11px]">Current Employees</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-3">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-3.5 w-3.5 me-1.5" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows: ManagerDashboardEmployee[] = data?.employees ?? [];

  if (!rows.length) {
    return (
      <Card className={cn("py-1.5 gap-0", className)}>
        <CardHeader className="pb-1 px-3">
          <CardTitle className="text-[11px]">Current Employees</CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          <div className="flex flex-col items-center gap-1.5 py-4 text-center">
            <p className="text-xs text-muted-foreground">No active employees found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "py-1.5 gap-0 bg-linear-to-r from-[#CFDEE7] via-[#E6F6FA] to-[#FBFEFF] dark:from-[#0E2A30]/25 dark:via-[#102F34]/20 dark:to-[#12363B]/18",
        className,
      )}
    >
      <CardHeader className="pb-1 px-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-[11px]">Current Employees</CardTitle>
            <CardDescription className="text-[9px] mt-0.5">
              Showing {rows.length} active employees
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            {isLoading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={refetch}
              disabled={isLoading}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            {canViewEmployees ? (
              <Button variant="outline" size="sm" className="h-6 text-[10px]" asChild>
                <Link href={`/${locale}/dashboard/employees`}>
                  <ExternalLink className="h-3.5 w-3.5 me-1.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-0">
        <div className="max-h-38 overflow-y-auto">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[9px] uppercase tracking-[0.02em]">Name</TableHead>
                  <TableHead className="text-[9px] uppercase tracking-[0.02em]">Position</TableHead>
                  <TableHead className="text-[9px] uppercase tracking-[0.02em]">Base Pay</TableHead>
                  <TableHead className="text-[9px] uppercase tracking-[0.02em]">Perf. Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((employee) => (
                  <TableRow
                    key={employee.employee_id}
                    className={cn(isLoading && "opacity-60")}
                  >
                    <TableCell className="text-[10px] py-2">
                      {formatEmployeeName(employee)}
                    </TableCell>
                    <TableCell className="text-[9px] text-muted-foreground py-2">
                      {employee.position}
                    </TableCell>
                    <TableCell className="text-[9px] text-muted-foreground py-2">
                      ${employee.base_pay}
                    </TableCell>
                    <TableCell className="text-[9px] text-muted-foreground py-2">
                      ${employee.performance_pay}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 md:hidden">
            {rows.map((employee) => (
              <div
                key={employee.employee_id}
                className={cn(
                  "rounded-md border p-2 space-y-1.5",
                  isLoading && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium">{formatEmployeeName(employee)}</p>
                  <span className="text-[9px] text-muted-foreground">{employee.position}</span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>${employee.base_pay} base</span>
                  <span>{employee.metric ? employee.metric.value : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
