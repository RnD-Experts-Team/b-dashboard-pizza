"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  PaginationBar,
  StorageEmptyState,
  StorageErrorCard,
  StorageSkeleton,
  TBL,
  TD,
  TH,
} from "./storage-shared";
import type {
  StockBalanceFilters,
  StockBalanceListResponse,
  StorageErrorState,
} from "@/types/storage.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  On hand, per part per location                                           */
/*                                                                            */
/*  Computed upstream over the WHOLE ledger. Never derived here by summing a  */
/*  page of movements — the ledger is unfiltered and paginated, so a page sum */
/*  is meaningless.                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const NEGATIVE_TITLE =
  "Negative balance — a reversal was applied after the stock had already been consumed. Ops can run `php artisan stock:reconcile` for the authoritative scan.";

interface BalancesTabProps {
  data: StockBalanceListResponse | null;
  isLoading: boolean;
  error: StorageErrorState | null;
  filters: StockBalanceFilters;
  onFiltersChange: (filters: StockBalanceFilters, page?: number) => void;
}

export function BalancesTab({
  data,
  isLoading,
  error,
  filters,
  onFiltersChange,
}: BalancesTabProps) {
  const [search, setSearch] = useState("");

  /** Server-side now, so it survives paging. Set here or by the KPI strip. */
  const negativeOnly = filters.negative_only ?? false;

  const rows = useMemo(() => {
    let out = data?.data ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (b) =>
          (b.part?.name ?? "").toLowerCase().includes(q) ||
          (b.storageLocation?.name ?? "").toLowerCase().includes(q) ||
          // The address too, level name included, so "shelf" and "C" both find
          // it -- same rule as the totals list, so one habit works on both.
          b.place.some(
            (line) =>
              line.value.toLowerCase().includes(q) ||
              line.level.toLowerCase().includes(q)
          )
      );
    }
    return out;
  }, [data, search]);

  if (isLoading && !data) return <StorageSkeleton />;
  if (error && !data) {
    return (
      <StorageErrorCard error={error} onRetry={() => onFiltersChange(filters, 1)} />
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter this page by part or location…"
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm sm:max-w-xs"
        />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={filters.non_zero ?? false}
            onCheckedChange={(v) =>
              onFiltersChange({ ...filters, non_zero: v === true }, 1)
            }
          />
          Hide zeroed-out pairs
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={negativeOnly}
            onCheckedChange={(v) =>
              onFiltersChange({ ...filters, negative_only: v === true }, 1)
            }
          />
          Negative only
        </label>
      </div>

      {rows.length === 0 ? (
        <StorageEmptyState
          title={negativeOnly ? "Nothing has gone negative" : "Nothing on hand yet"}
          description={
            negativeOnly
              ? "No part is short anywhere. Negatives appear when a reversal lands after the stock was already consumed."
              : "Balances appear once stock movements have been recorded against a part and a location."
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Part</th>
                  <th className={TH}>Location</th>
                  <th className={cn(TH, "text-end")}>On hand</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const negative = b.onHand < 0;
                  return (
                    <tr
                      key={`${b.partId}-${b.storageLocationId}`}
                      className="transition-colors hover:bg-muted/40"
                    >
                      <td className={TD}>
                        <span className="font-medium">
                          {b.part?.name ?? `Part #${b.partId}`}
                        </span>
                      </td>
                      <td className={TD}>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {b.storageLocation?.name ?? `Location #${b.storageLocationId}`}
                          {b.storageLocation?.code && (
                            <Badge
                              variant="outline"
                              className="h-4 px-1 text-[9px] font-normal"
                            >
                              {b.storageLocation.code}
                            </Badge>
                          )}
                          {/*
                            The address. This view is the one the page labels
                            "show it shelf by shelf" and it was the only one not
                            rendering a shelf -- the data arrived, was
                            transformed, and got dropped on the floor here.
                          */}
                          {b.place.length > 0 ? (
                            b.place.map((line) => (
                              <span
                                key={line.levelId}
                                title={`${line.level}: ${line.value}`}
                                className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground"
                              >
                                {line.value}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted-foreground opacity-60">
                              where not recorded
                            </span>
                          )}
                        </span>
                      </td>
                      {/* Never clamped. A negative is a real signal. */}
                      <td className={cn(TD, "text-end")}>
                        <span
                          title={negative ? NEGATIVE_TITLE : undefined}
                          className={cn(
                            "font-semibold tabular-nums",
                            negative && "cursor-help text-red-600 dark:text-red-400"
                          )}
                        >
                          {b.onHand}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Only the SEARCH box is page-scoped now; "Negative only" is a
              server filter and pages like any other. */}
          {search.trim() && data && (
            <p className="text-[11px] text-muted-foreground">
              Showing {rows.length} of {data.data.length} rows on this page
              {data.meta.total > data.data.length && ` (${data.meta.total} in total)`}.
              The search box looks at the loaded page only.
            </p>
          )}

          {data && (
            <PaginationBar
              currentPage={data.meta.currentPage}
              lastPage={data.meta.lastPage}
              onPageChange={(page) => onFiltersChange(filters, page)}
              disabled={isLoading}
            />
          )}
        </>
      )}
    </div>
  );
}
