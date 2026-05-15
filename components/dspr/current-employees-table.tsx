"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { CanAccessParams } from "@/lib/auth/can-access";
import { useAuth } from "@/lib/auth/use-auth";
import { employeeService } from "@/lib/api/services/employee.service";
import type {
  EmployeeV1Record,
  EmployeesV1PaginatedResponse,
} from "@/types/employee.types";
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
import { ExternalLink, RefreshCw, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurrentEmployeesTableProps {
  requirements?: CanAccessParams[];
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
        <div className="space-y-2">
          <div className="rounded-md border p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  {['Name', 'Gender', 'Type', 'Created'].map((heading) => (
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
        </div>
      </CardContent>
    </Card>
  );
}

function formatEmployeeName(employee: EmployeeV1Record) {
  return [employee.first_name, employee.middle_name, employee.last_name]
    .filter(Boolean)
    .join(" ");
}

export function CurrentEmployeesTable({ requirements, className }: CurrentEmployeesTableProps) {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { canAccessRoute } = useAuth();
  const { selectedStore } = useSelectedStoreStore();
  const [data, setData] = useState<EmployeesV1PaginatedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const storeId = selectedStore?.storeId ?? null;
  const canViewEmployees =
    requirements && requirements.length > 0
      ? requirements.some((requirement) => canAccessRoute(requirement))
      : true;

  const fetchData = useCallback(async () => {
    if (!storeId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const result = await employeeService.getEmployeesV1(
        storeId,
        { is_active: 1, per_page: 25 },
        controller.signal,
      );

      if (!controller.signal.aborted) {
        setData(result);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load current employee data.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [storeId]);

  useEffect(() => {
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  if (isLoading && !data) {
    return <CurrentEmployeesSkeleton />;
  }

  if (!storeId) {
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
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 me-1.5" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows = data?.data ?? [];
  const totalCount = data?.total;

  if (!rows.length) {
    return (
      <Card className={cn("py-1.5 gap-0", className)}>
        <CardHeader className="pb-1 px-3">
          <CardTitle className="text-[11px]">Current Employees</CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          <div className="flex flex-col items-center gap-1.5 py-4 text-center">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <p className="text-xs text-muted-foreground">
              No active employees found.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("  py-1.5 gap-0 bg-linear-to-r from-[#CFDEE7] via-[#E6F6FA] to-[#FBFEFF] dark:from-[#0E2A30]/25 dark:via-[#102F34]/20 dark:to-[#12363B]/18", className)}>
      <CardHeader className="pb-1 px-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-[11px]">Current Employees</CardTitle>
            <CardDescription className="text-[9px] mt-0.5">
              Showing {rows.length}{totalCount ? ` of ${totalCount}` : ""} active employees
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
              onClick={fetchData}
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
                  <TableHead className="text-[9px] uppercase tracking-[0.02em]">Gender</TableHead>
                  <TableHead className="text-[9px] uppercase tracking-[0.02em]">Emp. Type</TableHead>
                  {/* <TableHead className="text-[9px] uppercase tracking-[0.02em]">Created</TableHead> */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((employee) => (
                  <TableRow key={employee.id} className={cn(isLoading && "opacity-60")}> 
                    <TableCell className="text-[10px] py-2">
                      {formatEmployeeName(employee)}
                    </TableCell>
                    <TableCell className="text-[9px] text-muted-foreground py-2">
                      {employee.gender ?? "-"}
                    </TableCell>
                    <TableCell className="text-[9px] text-muted-foreground py-2">
                      {employee.employment_type ?? "-"}
                    </TableCell>
                    {/* <TableCell className="text-[9px] text-muted-foreground py-2">
                      {format(new Date(employee.created_at), "MMM dd, yyyy")}
                    </TableCell> */}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 md:hidden">
            {rows.map((employee) => (
              <div
                key={employee.id}
                className={cn(
                  "rounded-md border p-2 space-y-1.5",
                  isLoading && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium">{formatEmployeeName(employee)}</p>
                  <span className="text-[9px] text-muted-foreground">{employee.gender ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>{employee.employment_type ?? "-"}</span>
                  <span>{format(new Date(employee.created_at), "MMM dd, yyyy")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
