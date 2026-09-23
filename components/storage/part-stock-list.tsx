"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, MapPin, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { StorageEmptyState, PaginationBar, TBL, TH, TD } from "./storage-shared";
import { PlacePickerDialog } from "./place-picker-dialog";
import type {
  PartStockTotal,
  PartStockTotalListResponse,
  StockPlaceLine,
} from "@/types/storage.types";

/** What the picker needs to address one (part, location) row. */
interface PlaceTarget {
  balanceId: number;
  locationId: number;
  locationName: string;
  partName: string;
  current: StockPlaceLine[];
}

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
  /** Whether this user may say where things are. Same permission as managing
   *  the locations themselves -- laying a place out and filling it in are one
   *  job done by one person. */
  canSetPlace: boolean;
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
  canSetPlace,
  className,
}: PartStockListProps) {
  /** Which row the picker is open on. */
  const [target, setTarget] = useState<PlaceTarget | null>(null);
  /**
   * Addresses saved since this page was fetched, by balance id.
   *
   * Kept locally rather than refetching the whole page: tagging a shelf changes
   * one cell, and throwing away the list and the scroll position to learn
   * something we were just told would be a worse trade than a small override
   * map. It is dropped the moment the page refetches for any real reason.
   */
  const [saved, setSaved] = useState<Record<number, StockPlaceLine[]>>({});
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
          (loc.storageLocation?.name ?? "").toLowerCase().includes(needle) ||
          // Searches the address too, level name included, so both "shelf" and
          // "C" find it -- "which shelf was that on" is exactly as common a
          // question as "have we got any", and both start from this box.
          loc.place.some(
            (line) =>
              line.value.toLowerCase().includes(needle) ||
              line.level.toLowerCase().includes(needle)
          )
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
                  canSetPlace={canSetPlace}
                  saved={saved}
                  onSetPlace={setTarget}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Said next to the pagination bar, not only inside the empty state:
          this is where someone wonders why a part they know exists is missing. */}
      {search.trim() && data && rows.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Showing {rows.length} of {data.data.length} parts on this page
          {data.meta.total > data.data.length && ` (${data.meta.total} in total)`}.
          The search box looks at the loaded page only.
        </p>
      )}

      {data && (
        <PaginationBar
          currentPage={page}
          lastPage={data.meta.lastPage}
          onPageChange={onPageChange}
          disabled={isLoading || isRefreshing}
        />
      )}

      {target && (
        <PlacePickerDialog
          open
          onOpenChange={(open) => !open && setTarget(null)}
          balanceId={target.balanceId}
          locationId={target.locationId}
          locationName={target.locationName}
          partName={target.partName}
          current={target.current}
          canManage={canSetPlace}
          onSaved={(place) => setSaved((prev) => ({ ...prev, [target.balanceId]: place }))}
        />
      )}
    </div>
  );
}

function PartRow({
  row,
  isExpanded,
  onToggle,
  canSetPlace,
  saved,
  onSetPlace,
}: {
  row: PartStockTotal;
  isExpanded: boolean;
  onToggle: () => void;
  canSetPlace: boolean;
  saved: Record<number, StockPlaceLine[]>;
  onSetPlace: (target: PlaceTarget) => void;
}) {
  /** What the server said, unless this session has since changed it. */
  const placeOf = (loc: PartStockTotal["locations"][number]) =>
    (loc.stockBalanceId != null ? saved[loc.stockBalanceId] : undefined) ?? loc.place;
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
          ) : (
            <span className="flex flex-wrap items-center gap-1.5">
              <span>
                {row.locationCount === 1
                  ? (row.locations[0]?.storageLocation?.name ?? "1 place")
                  : `${row.locationCount} places`}
              </span>
              {/*
                The address shows even when the part is in SEVERAL locations --
                it used to collapse to a bare "3 places", which threw away the
                one thing this column exists to answer. With several, the first
                is shown and the rest are behind the expander.
              */}
              <PlaceChips place={row.locations[0] ? placeOf(row.locations[0]) : []} />
              {row.locationCount > 1 && (
                <span className="text-[10px] opacity-60">and {row.locationCount - 1} more</span>
              )}
            </span>
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
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-muted-foreground">
                    {loc.storageLocation?.name ?? `Location #${loc.storageLocationId}`}
                    <PlaceChips place={placeOf(loc)} />

                    {/*
                      THE CONTROL THAT DID NOT EXIST. Shelves could be named and
                      displayed, and nothing anywhere could put a part on one --
                      so the "not recorded" branch was the only one a real
                      balance could take. Tagging lives here, on the stock list,
                      because retagging after a tidy-up is not a stock movement
                      and has no honest home in the movement composer.
                    */}
                    {canSetPlace && loc.stockBalanceId != null && (
                      <button
                        type="button"
                        onClick={() =>
                          onSetPlace({
                            balanceId: loc.stockBalanceId!,
                            locationId: loc.storageLocationId,
                            locationName:
                              loc.storageLocation?.name ?? `Location #${loc.storageLocationId}`,
                            partName: row.part?.name ?? `Part #${row.partId}`,
                            current: placeOf(loc),
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {placeOf(loc).length > 0 ? "change" : "say where"}
                      </button>
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


/**
 * An address as chips -- "C  8  5".
 *
 * An EMPTY address prints "where not recorded" rather than nothing, because
 * "nobody has told us" is a real answer and a different one from "nowhere". A
 * blank cell would read as the latter, and would also hide the fact that it is
 * one click from being fixed.
 */
function PlaceChips({ place }: { place: StockPlaceLine[] }) {
  if (place.length === 0) {
    return <span className="text-[10px] opacity-60">where not recorded</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {place.map((line) => (
        <span
          key={line.levelId}
          // The level name is in the title rather than on screen: the values
          // are what you scan for, and "Shelf C Row 8 Column 5" is three times
          // the width of "C 8 5" for the same information.
          title={`${line.level}: ${line.value}`}
          className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground"
        >
          {line.value}
        </span>
      ))}
    </span>
  );
}
