"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import {
  maintenanceService,
  MaintenanceError,
} from "@/lib/api/services/maintenance.service";
import type { MaintenanceResponse } from "@/types/maintenance.types";
import { MaintenanceRequestDetailsSheet } from "@/components/maintenance/maintenance-request-details-sheet";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Wrench,
  RefreshCw,
  ExternalLink,
  Loader2,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Status helpers                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const statusConfig: Record<
  string,
  {
    icon: typeof CheckCircle2;
    className: string;
  }
> = {
  done: {
    icon: CheckCircle2,
    className:
      "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/30",
  },
  in_progress: {
    icon: Clock,
    className:
      "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/30",
  },
  pending: {
    icon: AlertCircle,
    className:
      "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/30",
  },
  cancelled: {
    icon: XCircle,
    className:
      "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/30",
  },
  canceled: {
    icon: XCircle,
    className:
      "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/30",
  },
};

function getStatusConfig(status: string) {
  return (
    statusConfig[status] ?? {
      icon: AlertCircle,
      className: "",
    }
  );
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Skeleton                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function RecentMaintenanceSkeleton() {
  return (
    <Card className="py-1.5 gap-0">
      <CardHeader className="pb-1 px-3">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-3 w-48 mt-0.5" />
      </CardHeader>
      <CardContent className="px-3">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-10" />
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-4 w-18 rounded-full" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Component                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export function RecentMaintenanceTable() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { selectedStore } = useSelectedStoreStore();
  const [data, setData] = useState<MaintenanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const storeId = selectedStore?.storeId ?? null;

  const openDetails = useCallback((requestId: number) => {
    setSelectedRequestId(requestId);
    setIsDetailsOpen(true);
  }, []);

  const fetchData = useCallback(async () => {
    if (!storeId) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const result = await maintenanceService.getRequests(
        storeId,
        1,
        controller.signal,
        5
      );
      if (!controller.signal.aborted) {
        setData(result);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof MaintenanceError) {
        setError(err.message);
      } else {
        setError("Failed to load maintenance requests.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [storeId]);

  // Fetch on mount & when store changes
  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  // ── Loading state ────────────────────────────────────────────────────
  if (isLoading && !data) {
    return <RecentMaintenanceSkeleton />;
  }

  // ── No store selected ────────────────────────────────────────────────
  if (!storeId) {
    return null;
  }

  // ── Error state ──────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <Card className="py-1.5 gap-0 ">
        <CardHeader className="pb-1 px-3">
          <CardTitle className="flex items-center gap-1 text-[11px]">
            <Wrench className="h-3 w-3" />
            Recent Maintenance Requests
          </CardTitle>
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

  // ── Empty state ──────────────────────────────────────────────────────
  if (!data || data.data.length === 0) {
    return (
      <Card className="py-1.5 gap-0">
        <CardHeader className="pb-1 px-3">
          <CardTitle className="flex items-center gap-1 text-[11px]">
            <Wrench className="h-3 w-3" />
            Recent Maintenance Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          <div className="flex flex-col items-center gap-1.5 py-4 text-center">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <p className="text-xs text-muted-foreground">
              No maintenance requests found.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Data table ───────────────────────────────────────────────────────
  return (
    <Card className="py-1.5 gap-0 bg-gradient-to-r from-[#CFDEE7] via-[#E6F6FA] to-[#FBFEFF] dark:from-[#0E2A30]/25 dark:via-[#102F34]/20 dark:to-[#12363B]/18">
      <CardHeader className="pb-1 px-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-1 text-[11px]">
              <Wrench className="h-3 w-3" />
              Recent Maintenance
            </CardTitle>
            <CardDescription className="text-[9px] mt-0.5">
              Latest {data.data.length}{data.pagination?.total ? ` of ${data.pagination.total}` : data.count ? ` of ${data.count}` : ""} requests
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
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px]"
              asChild
            >
              <Link href={`/${locale}/dashboard/maintenance`}>
                
                <ExternalLink className="h-2.5 w-2.5 ms-1" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-0">
        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
           
            <TableBody>
              {data.data.map((request) => {
                const config = getStatusConfig(request.status);
                const StatusIcon = config.icon;

                return (
                  <TableRow
                    key={request.id}
                    className={cn(
                      "cursor-pointer",
                      isLoading && "opacity-60"
                    )}
                    onClick={() => openDetails(request.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDetails(request.id);
                      }
                    }}
                  >
                    {/* <TableCell className="font-mono text-xs">
                      #{request.id}
                    </TableCell> */}
                    {/* <TableCell className="font-medium text-sm">
                      {request.entryNumber}
                    </TableCell> */}
                    <TableCell className="text-[9px] text-muted-foreground">
                      {format(
                        new Date(request.submittedAt),
                        "MMM dd,yyyy"
                      )}
                    </TableCell>
                    <TableCell className="text-[11px] py-0">
                      {request.brokenItem}
                    </TableCell>
                    <TableCell className="text-[7px] py-0">
                      <Badge className={cn("gap-1 text-[7px] py-0", config.className)}>
                        <StatusIcon className="text-[7px] h-3 w-3" />
                        {formatStatusLabel(request.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-2 md:hidden">
          {data.data.map((request) => {
            const config = getStatusConfig(request.status);
            const StatusIcon = config.icon;

            return (
              <div
                key={request.id}
                className={cn(
                  "rounded-md border p-2 space-y-1.5 cursor-pointer",
                  isLoading && "opacity-60"
                )}
                onClick={() => openDetails(request.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openDetails(request.id);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    #{request.id}
                  </span>
                  <Badge className={cn("gap-1 text-xs", config.className)}>
                    <StatusIcon className="h-3 w-3" />
                    {formatStatusLabel(request.status)}
                  </Badge>
                </div>
                <p className="text-xs font-medium">{request.brokenItem}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Entry #{request.entryNumber}</span>
                  <span>
                    {format(
                      new Date(request.submittedAt),
                      "MMM dd, yyyy HH:mm"
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <MaintenanceRequestDetailsSheet
        requestId={selectedRequestId}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </Card>
  );
}
