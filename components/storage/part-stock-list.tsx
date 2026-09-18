"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { StorageEmptyState, PaginationBar, TBL, TH, TD } from "./storage-shared";
import type { PartStockTotal, PartStockTotalListResponse } from "@/types/storage.types";

/**
 * What we have, one row per part.
 *
 * The old Balances tab listed one row per (part, location) with, by explicit
 * design, no total anywhere -- so a thermocouple on four shelves was four rows
 * and "how many do we have" had to be done in your head. That was the complaint.
 *
 * The total is now the headline and the shelves are the detail, one click away.
 * The figure comes from the server's own cross-location sum, never from adding
 * up this page: the listing paginates, so a page total would be a lie that
 * happens to be right sometimes.
 */

interface PartStockListProps {
  data: PartStockTotalListResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  page: number;
  onPageChange: (page: number) => void;
  /** Server-side: hides parts whose total has netted back to nothing. */
  hideEmpty: boolean;
  onHideEmptyChange: (value: boolean) => void;
  className?: string;
}

export function PartStockList({
  data,
  isLoading,
  isRefreshing,
  page,
  onPageChange,
  hideEmpty,
  onHideEmptyChange,
  className,
}: PartStockListProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const rows = (data?.data ?? []).filter((row) => {
    if (!search) return true;
    const needle = search.toLowerCase();
    // Searches the slot too -- "which shelf was that on" is exactly as common a
    // question as "have we got any", and both start from this box.
    return (
      (row.part?.name ?? "").toLowerCase().includes(needle) ||
      row.locations.some(
        (loc) =>
          (loc.storageSlot?.name ?? "").toLowerCase().includes(needle) ||
          (loc.storageLocation?.name ?? "").toLowerCase().includes(needle)
      )
    );
  });

  function toggle(partId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(partId)) next.delete(partId);
      else next.add(partId);
      return next;
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a part, a shelf, or a location…"
          className="h-9 max-w-xs text-sm"
          aria-label="Find a part, a shelf, or a location on this page"
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="hide-empty"
            checked={hideEmpty}
            onCheckedChange={(v) => onHideEmptyChange(Boolean(v))}
          />
          <Label htmlFor="hide-empty" className="text-xs text-muted-foreground">
            Hide parts we have none of
          </Label>
        </div>
      </div>

      {!isLoading && rows.length === 0 && (
        <StorageEmptyState
          title={search ? "Nothing on this page matches" : "No stock recorded yet"}
          description={
            search
              ? "The search only looks at the parts loaded on this page. Try another page, or clear it."
              : "A part appears here once something has been recorded going in or out of a location."
          }
        />
      )}

      {rows.length > 0 && (
        <div
          className={cn(
            "overflow-hidden rounded-lg border transition-opacity",
            isRefreshing && "pointer-events-none opacity-60"
          )}
        >
          <table className={TBL}>
            <thead className="bg-muted/40">
              <tr>
                <th className={TH} style={{ width: 28 }} />
                <th className={TH}>Part</th>
                <th className={cn(TH, "text-end")}>We have</th>
                <th className={cn(TH, "text-end")}>Worth</th>
                <th className={TH}>Where</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <PartRow
                  key={row.partId}
                  row={row}
                  isExpanded={expanded.has(row.partId)}
                  onToggle={() => toggle(row.partId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <PaginationBar
          currentPage={page}
          lastPage={data.meta.lastPage}
          onPageChange={onPageChange}
          disabled={isLoading || isRefreshing}
        />
      )}
    </div>
  );
}

function PartRow({
  row,
  isExpanded,
  onToggle,
}: {
  row: PartStockTotal;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isNegative = row.onHand < 0;
  const canExpand = row.locations.length > 0;
  const hasUnpricedStock = (row.unknownCostQuantity ?? 0) > 0;

  return (
    <>
      <tr
        className={cn("cursor-pointer hover:bg-accent/50", canExpand || "cursor-default")}
        onClick={canExpand ? onToggle : undefined}
      >
        <td className={cn(TD, "align-middle")}>
          {canExpand &&
            (isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ))}
        </td>
        <td className={TD}>
          <span className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{row.part?.name ?? `Part #${row.partId}`}</span>
          </span>
        </td>
        <td className={cn(TD, "text-end")}>
          {/* Never clamped. A negative is the trace of a reversal applied after
              the stock had already gone, and it is a real signal that something
              needs reconciling -- hiding it would hide the problem. */}
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              isNegative && "text-red-600 dark:text-red-400"
            )}
          >
            {row.onHand}
          </span>
        </td>
        <td className={cn(TD, "text-end")}>
          {/*
            An em dash, never a zero, when we were not told. And when part of
            the stock has no recorded price, the figure is flagged as an
            understatement rather than presented as the answer -- we never
            invent a price to fill the gap, so the gap has to be visible.
          */}
          {row.value == null ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <span className="text-sm tabular-nums">{row.value.toFixed(2)}</span>
              {hasUnpricedStock && (
                <span
                  title={`${row.unknownCostQuantity} of these have no recorded price, so they count as nothing here. The real figure is higher.`}
                  className="text-[10px] text-amber-700 dark:text-amber-400"
                >
                  at least
                </span>
              )}
            </span>
          )}
        </td>
        <td className={cn(TD, "text-muted-foreground")}>
          {row.locationCount === 0 ? (
            "—"
          ) : row.locationCount === 1 ? (
            <span className="flex flex-wrap items-center gap-1">
              <span>{row.locations[0]?.storageLocation?.name ?? "1 place"}</span>
              {/* The whole point of slots: at a glance, where to walk to. */}
              {row.locations[0]?.storageSlot && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground">
                  {row.locations[0].storageSlot.name}
                </span>
              )}
            </span>
          ) : (
            `${row.locationCount} places`
          )}
        </td>
      </tr>

      {isExpanded && canExpand && (
        <tr>
          <td className={cn(TD, "bg-muted/20")} colSpan={5}>
            <div className="space-y-1 ps-6">
              {row.locations.map((loc) => (
                <div
                  key={loc.storageLocationId}
                  className="flex items-center justify-between gap-4 text-xs"
                >
                  <span className="min-w-0 text-muted-foreground">
                    {loc.storageLocation?.name ?? `Location #${loc.storageLocationId}`}
                    {/* Where exactly, when somebody has said. A blank is not
                        "nowhere" -- it is "nobody has told us", which is worth
                        distinguishing so it can be filled in. */}
                    {loc.storageSlot ? (
                      <span className="ms-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground">
                        {loc.storageSlot.name}
                      </span>
                    ) : (
                      <span className="ms-1.5 text-[10px] opacity-60">shelf not recorded</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "tabular-nums",
                      loc.onHand < 0 && "text-red-600 dark:text-red-400"
                    )}
                  >
                    {loc.onHand}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
