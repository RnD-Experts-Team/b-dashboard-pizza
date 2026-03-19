"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import type { MaintenanceResponse } from "@/types/maintenance.types";
import type { CanAccessParams } from "@/lib/auth/can-access";
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
import { useAuth } from "@/lib/auth/use-auth";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Wrench,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface MaintenanceRequestsTableProps {
  data: MaintenanceResponse;
  isRefreshing: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  requirements?: CanAccessParams[];
}

const statusConfig: Record<
  string,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: typeof CheckCircle2;
    className: string;
  }
> = {
  done: {
    variant: "default",
    icon: CheckCircle2,
    className:
      "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/30",
  },
  in_progress: {
    variant: "secondary",
    icon: Clock,
    className:
      "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/30",
  },
  pending: {
    variant: "outline",
    icon: AlertCircle,
    className:
      "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/30",
  },
  cancelled: {
    variant: "destructive",
    icon: XCircle,
    className:
      "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/30",
  },
  canceled: {
    variant: "destructive",
    icon: XCircle,
    className:
      "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/30",
  },
};

function getStatusConfig(status: string) {
  return (
    statusConfig[status] ?? {
      variant: "outline" as const,
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

export function MaintenanceRequestsTable({
  data,
  isRefreshing,
  currentPage,
  onPageChange,
  requirements,
}: MaintenanceRequestsTableProps) {
  const t = useTranslations("maintenance");
  const { canAccessRoute } = useAuth();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const { pagination } = data;
  const hasNextPage = !!data.links?.next;
  const hasPrevPage = !!data.links?.prev;
  const canOpenDetails =
    requirements && requirements.length > 0
      ? requirements.some((requirement) => canAccessRoute(requirement))
      : true;

  const openDetails = (requestId: number) => {
    if (!canOpenDetails) return;
    setSelectedRequestId(requestId);
    setIsDetailsOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {data.storeName}
            </CardTitle>
            <CardDescription>
              {t("storeNumber")}: {data.storeNumber}
              {pagination && (
                <> &middot; {t("showing", { from: pagination.from, to: pagination.to, total: pagination.total })}</>
              )}
            </CardDescription>
          </div>
          {isRefreshing && (
            <span className="text-xs text-muted-foreground animate-pulse">
              {t("refreshing")}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">{t("columns.id")}</TableHead>
                <TableHead>{t("columns.entryNumber")}</TableHead>
                <TableHead>{t("columns.brokenItem")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.submittedAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((request) => {
                const config = getStatusConfig(request.status);
                const StatusIcon = config.icon;

                return (
                  <TableRow
                    key={request.id}
                    className={cn(
                      isRefreshing && "opacity-60"
                    )}
                    onClick={() => openDetails(request.id)}
                    role={canOpenDetails ? "button" : undefined}
                    tabIndex={canOpenDetails ? 0 : -1}
                    aria-disabled={!canOpenDetails}
                    title={
                      canOpenDetails
                        ? undefined
                        : "You do not have permission to view maintenance request details."
                    }
                    onKeyDown={(event) => {
                      if (!canOpenDetails) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDetails(request.id);
                      }
                    }}
                  >
                    <TableCell className="font-mono text-sm">
                      #{request.id}
                    </TableCell>
                    <TableCell className="font-medium">
                      {request.entryNumber}
                    </TableCell>
                    <TableCell>{request.brokenItem}</TableCell>
                    <TableCell>
                      <Badge className={cn("gap-1", config.className)}>
                        <StatusIcon className="h-3 w-3" />
                        {formatStatusLabel(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(
                        new Date(request.submittedAt),
                        "MMM dd, yyyy HH:mm"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {data.data.map((request) => {
            const config = getStatusConfig(request.status);
            const StatusIcon = config.icon;

            return (
              <div
                key={request.id}
                className={cn(
                  "rounded-lg border p-4 space-y-3",
                  canOpenDetails ? "cursor-pointer" : "cursor-not-allowed opacity-70",
                  isRefreshing && "opacity-60"
                )}
                onClick={() => openDetails(request.id)}
                role={canOpenDetails ? "button" : undefined}
                tabIndex={canOpenDetails ? 0 : -1}
                aria-disabled={!canOpenDetails}
                title={
                  canOpenDetails
                    ? undefined
                    : "You do not have permission to view maintenance request details."
                }
                onKeyDown={(event) => {
                  if (!canOpenDetails) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openDetails(request.id);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-muted-foreground">
                    #{request.id}
                  </span>
                  <Badge className={cn("gap-1", config.className)}>
                    <StatusIcon className="h-3 w-3" />
                    {formatStatusLabel(request.status)}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t("columns.entryNumber")}
                    </span>
                    <span className="text-sm font-medium">
                      {request.entryNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t("columns.brokenItem")}
                    </span>
                    <span className="text-sm font-medium">
                      {request.brokenItem}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t("columns.submittedAt")}
                    </span>
                    <span className="text-sm">
                      {format(
                        new Date(request.submittedAt),
                        "MMM dd, yyyy HH:mm"
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Pagination controls */}
      {pagination && pagination.lastPage > 1 && (
        <div className="flex items-center justify-between border-t px-6 py-4">
          <p className="text-sm text-muted-foreground">
            {t("pagination.page", { current: currentPage, total: pagination.lastPage })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(1)}
              disabled={!hasPrevPage || isRefreshing}
              aria-label={t("pagination.first")}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!hasPrevPage || isRefreshing}
              aria-label={t("pagination.previous")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!hasNextPage || isRefreshing}
              aria-label={t("pagination.next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(pagination!.lastPage)}
              disabled={!hasNextPage || isRefreshing}
              aria-label={t("pagination.last")}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <MaintenanceRequestDetailsSheet
        requestId={selectedRequestId}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </Card>
  );
}
