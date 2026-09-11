"use client";

import { AlertTriangle, Inbox, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StorageErrorState } from "@/types/storage.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shared shells for the three storage tabs                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export function StorageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function StorageEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function StorageErrorCard({
  error,
  onRetry,
}: {
  error: StorageErrorState;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/50 py-16 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <div className="space-y-1">
        <p className="text-sm text-destructive">{error.message}</p>
        <p className="text-xs text-muted-foreground">{error.code}</p>
      </div>
      {error.retryable && onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="me-1.5 h-3.5 w-3.5" />
          Try again
        </Button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Compact table classes, matching the dense dashboard idiom                */
/* ────────────────────────────────────────────────────────────────────────── */

export const TBL = "w-full text-xs";
export const TH =
  "px-2.5 py-1.5 text-start text-[9px] font-semibold uppercase tracking-wider text-muted-foreground";
export const TD = "px-2.5 py-2 border-t border-border align-top";

/** A quantity that carries its sign. Negative is meaningful, never an error. */
export function SignedQty({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        value < 0 ? "text-red-600 dark:text-red-400" : value > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
        className
      )}
    >
      {value > 0 ? "+" : ""}
      {value}
    </span>
  );
}

export function PaginationBar({
  currentPage,
  lastPage,
  onPageChange,
  disabled,
}: {
  currentPage: number;
  lastPage: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (lastPage <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <p className="text-xs text-muted-foreground">
        Page {currentPage} of {lastPage}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={disabled || currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={disabled || currentPage >= lastPage}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
