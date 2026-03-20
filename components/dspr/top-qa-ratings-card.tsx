"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { format, subDays } from "date-fns";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { qaService, QAError } from "@/lib/api/services/qa.service";
import type { QARatingsSummaryItem } from "@/types/qa.types";
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
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Star,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanAccessParams } from "@/lib/auth/can-access";
import { useAuth } from "@/lib/auth/use-auth";

function TopQaRatingsSkeleton() {
  return (
    <Card className="py-1.5 gap-0">
      <CardHeader className="pb-1 px-3">
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-3 rounded" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-2.5 w-44 mt-0.5" />
      </CardHeader>
      <CardContent className="px-3">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function getDefaultDateRange() {
  const today = new Date();
  return {
    dateStart: format(subDays(today, 6), "yyyy-MM-dd"),
    dateEnd: format(today, "yyyy-MM-dd"),
  };
}

export function TopQaRatingsCard({
  requiredPermission,
  requirements,
}: {
  requiredPermission?: string;
  requirements?: CanAccessParams[];
}) {
  const { hasPermission, canAccessRoute } = useAuth();

  // Authorization: mirror sidebar behavior — fail-open when no requirements
  if (requiredPermission) {
    if (!hasPermission(requiredPermission)) return null;
  }
  if (requirements && requirements.length > 0) {
    const ok = requirements.some((req) => canAccessRoute(req));
    if (!ok) return null;
  }

  const { selectedStore } = useSelectedStoreStore();
  const [data, setData] = useState<QARatingsSummaryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const pathname = usePathname();
  const locale = useMemo(() => {
    if (!pathname) return "en";
    const parts = pathname.split("/").filter(Boolean);
    return parts[0] ?? "en";
  }, [pathname]);

  const storeId = selectedStore?.storeId ?? selectedStore?.id ?? null;
  const { dateStart, dateEnd } = useMemo(() => getDefaultDateRange(), []);

  const fetchData = useCallback(async () => {
    if (!storeId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const result = await qaService.getRatingsSummary(
        storeId,
        dateStart,
        dateEnd,
        controller.signal
      );

      if (!controller.signal.aborted) {
        setData(result.slice(0, 5));
      }
    } catch (err) {
      if (controller.signal.aborted) return;

      if (err instanceof QAError) {
        if (err.code === "NOT_AUTHENTICATED" || err.code === "UNAUTHORIZED") {
          setError("Authentication required to load QA ratings.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to load QA ratings summary.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [storeId, dateStart, dateEnd]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  if (isLoading && !data) {
    return <TopQaRatingsSkeleton />;
  }

  if (!storeId) {
    return null;
  }

  if (error && !data) {
    return (
      <Card className="py-1.5 gap-0">
        <CardHeader className="pb-1 px-3">
          <CardTitle className="flex items-center gap-1 text-[11px]">
            <Star className="h-3 w-3" />
            Top 5 QA Ratings
          </CardTitle>
          <CardDescription className="text-[9px] mt-0.5">
            Last 7 days ({dateStart} → {dateEnd})
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <ShieldAlert className="h-6 w-6 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 me-1.5" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="py-1.5 gap-0">
        <CardHeader className="pb-1 px-3">
          <CardTitle className="flex items-center gap-1 text-[11px]">
            <Star className="h-3 w-3" />
            Top 5 QA Ratings
          </CardTitle>
          <CardDescription className="text-[9px] mt-0.5">
            Last 7 days ({dateStart} → {dateEnd})
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3">
          <div className="flex flex-col items-center gap-1.5 py-4 text-center">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <p className="text-[11px] text-muted-foreground">
              No QA rating issues found for this period.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-1.5 gap-0 bg-linear-to-r from-[#CFDEE7] via-[#E6F6FA] to-[#FBFEFF] dark:from-[#0E2A30]/30 dark:via-[#102F34]/40 dark:to-[#12363B]/50">
      <CardHeader className="pb-1 px-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-1 text-[11px]">
              <Star className="h-3 w-3" />
              Top 5 QA Ratings
            </CardTitle>
            <CardDescription className="text-[9px] mt-0.5">
              Last 7 days ({dateStart} → {dateEnd})
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
              <Link href={`/${locale}/dashboard/quality-assurance`}>
                <ExternalLink className="h-2.5 w-2.5 ms-1" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-1">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              {/* <TableRow>
                <TableHead className="text-[11px] w-[52%] p-0">Entity</TableHead>
                <TableHead className="text-right text-[11px] p-0">Auto Fail</TableHead>
                <TableHead className="text-right text-[11px] p-0">Urgent</TableHead>
                <TableHead className="text-right text-[11px] p-0">Total</TableHead>
              </TableRow> */}
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.entityId} className={cn(isLoading && "opacity-60 ")}>
                  <TableCell className="text-[9px] font-medium p-0">{item.entityLabel}</TableCell>
                  <TableCell className="text-[9px] text-right py-1">
                    <Badge className="text-[9px]" variant="secondary">{item.autoFailCount} autoFail</Badge>
                  </TableCell>
                  <TableCell className="text-[9px] text-right p-0">
                    <Badge className="text-[9px]" variant="outline">{item.urgentCount} urgent</Badge>
                  </TableCell>
                  {/* <TableCell className="text-[11px] text-right">
                    <Badge>{item.totalCount} total</Badge>
                  </TableCell> */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-2 md:hidden">
          {data.map((item, index) => (
            <div
              key={item.entityId}
              className={cn("rounded-md border p-2 space-y-1.5", isLoading && "opacity-60")}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium line-clamp-2">{item.entityLabel}</p>
                <Badge variant="outline" className="shrink-0">#{index + 1}</Badge>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <Badge variant="secondary" className="gap-0.5">
                  <AlertCircle className="h-2.5 w-2.5" />
                  Auto Fail: {item.autoFailCount}
                </Badge>
                <Badge variant="outline">Urgent: {item.urgentCount}</Badge>
                <Badge>Total: {item.totalCount}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
