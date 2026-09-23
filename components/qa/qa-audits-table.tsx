"use client";

import { useTranslations } from "next-intl";
import { formatDateOrTimestamp, formatTimestamp } from "@/lib/utils/date-display";
import type { QAAuditsResponse } from "@/types/qa.types";
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
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building2,
  User,
  Calendar,
} from "lucide-react";

interface QAAuditsTableProps {
  data: QAAuditsResponse;
  isRefreshing: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function QAAuditsTable({
  data,
  isRefreshing,
  currentPage,
  onPageChange,
}: QAAuditsTableProps) {
  const t = useTranslations("qa");
  const { pagination } = data;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {t("tableTitle")}
            </CardTitle>
            <CardDescription>
              {pagination.from && pagination.to
                ? t("showing", {
                    from: pagination.from,
                    to: pagination.to,
                    total: pagination.total,
                  })
                : t("totalAudits", { total: pagination.total })}
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
                <TableHead>{t("columns.store")}</TableHead>
                <TableHead>{t("columns.auditor")}</TableHead>
                <TableHead>{t("columns.email")}</TableHead>
                <TableHead>{t("columns.date")}</TableHead>
                <TableHead>{t("columns.createdAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.audits.map((audit) => (
                <TableRow
                  key={audit.id}
                  className={cn(isRefreshing && "opacity-60")}
                >
                  <TableCell className="font-mono text-sm">
                    #{audit.id}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{audit.store.store}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{audit.user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {audit.user.email}
                  </TableCell>
                  <TableCell>
                    {formatDateOrTimestamp(audit.date, "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTimestamp(audit.createdAt, "MMM dd, yyyy HH:mm")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {data.audits.map((audit) => (
            <div
              key={audit.id}
              className={cn(
                "rounded-lg border p-4 space-y-3",
                isRefreshing && "opacity-60"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-muted-foreground">
                  #{audit.id}
                </span>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateOrTimestamp(audit.date, "MMM dd, yyyy")}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t("columns.store")}
                  </span>
                  <span className="text-sm font-medium text-end">
                    {audit.store.store}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t("columns.auditor")}
                  </span>
                  <span className="text-sm font-medium">
                    {audit.user.name}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t("columns.email")}
                  </span>
                  <span className="text-sm text-end break-all">
                    {audit.user.email}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t("columns.createdAt")}
                  </span>
                  <span className="text-sm">
                    {formatTimestamp(audit.createdAt, "MMM dd, yyyy HH:mm")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Pagination controls */}
      {pagination.lastPage > 1 && (
        <div className="flex items-center justify-between border-t px-6 py-4">
          <p className="text-sm text-muted-foreground">
            {t("pagination.page", {
              current: currentPage,
              total: pagination.lastPage,
            })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(1)}
              disabled={!data.hasPrevPage || isRefreshing}
              aria-label={t("pagination.first")}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!data.hasPrevPage || isRefreshing}
              aria-label={t("pagination.previous")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!data.hasNextPage || isRefreshing}
              aria-label={t("pagination.next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(pagination.lastPage)}
              disabled={!data.hasNextPage || isRefreshing}
              aria-label={t("pagination.last")}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
