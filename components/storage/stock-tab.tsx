"use client";

import { useEffect, useMemo, useState } from "react";
import { Hash, Info, MapPin, Package, Plus, Search, Warehouse } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useParts } from "@/lib/hooks/use-maintenance-catalog";
import { useStockTotals } from "@/lib/hooks/use-storage";
import { formatMoney, formatQuantity } from "@/lib/maintenance/money";
import { PART_UNITS, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import { partHint } from "@/lib/storage/stock-forms";
import { PlacePickerDialog } from "./place-picker-dialog";
import {
  PaginationBar,
  PlaceBreadcrumb,
  StorageEmptyState,
  StorageErrorState,
  StorageSkeleton,
  TBL,
  TD,
  TH,
  signTone,
} from "./storage-shared";
import type { Part } from "@/types/maintenance-system";
import type { PartStockLocation, StockPlaceLine, StorageLocation } from "@/types/storage.types";

/**
 * Stock: what we have, one row per part — on hand at each location with its
 * spot ("Zone A › Shelf S"), the total, and what it is worth. Click a part for
 * its sheet (details, serials, price history).
 *
 * Stock balances have no text search, so the search asks the parts catalog
 * (`GET parts?search=`: name, brand, model, part number, matched upstream)
 * and then asks for those part ids.
 */

const PER_PAGE = 50;
/** Above this many matching parts the id list would overflow the URL; the page is filtered locally instead. */
const MAX_ID_FILTER = 150;
const SEARCH_DEBOUNCE_MS = 250;
const ALL = "__all__";

interface SpotTarget {
  balanceId: number;
  locationId: number;
  locationName: string;
  partName: string;
  current: StockPlaceLine[];
}

export interface StockTabProps {
  search: string;
  locationId?: number;
  onFiltersChange: (patch: { q?: string | null; loc?: number | null }) => void;
  parts: readonly Part[];
  locations: readonly StorageLocation[];
  onOpenPart: (partId: number) => void;
  onAddPart?: () => void;
  canSetSpot: boolean;
  /** Bumped after any write so the list reloads. */
  revision: number;
}

export function StockTab({
  search,
  locationId,
  onFiltersChange,
  parts,
  locations,
  onOpenPart,
  onAddPart,
  canSetSpot,
  revision,
}: StockTabProps) {
  const t = useTranslations("maintenanceSystem");
  const [draft, setDraft] = useState(search);
  const [page, setPage] = useState(1);
  const [spot, setSpot] = useState<SpotTarget | null>(null);

  // The URL is the truth: Back/Clear all put its search back in the box.
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (search !== syncedSearch) {
    setSyncedSearch(search);
    setDraft(search);
  }
  useEffect(() => {
    if (draft === search) return;
    const id = setTimeout(() => onFiltersChange({ q: draft.trim() || null }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [draft, search, onFiltersChange]);
  // A new search or location starts again at page 1.
  const filterKey = `${search}|${locationId ?? ""}`;
  const [pageKey, setPageKey] = useState(filterKey);
  if (pageKey !== filterKey) {
    setPageKey(filterKey);
    setPage(1);
  }

  const q = search.trim();
  const partSearch = useParts({ search: q }, Boolean(q));
  const searching = partSearch.isLoading || partSearch.isRefreshing;
  const matching = q && !searching ? partSearch.parts : null;
  const idFilter = matching && matching.length <= MAX_ID_FILTER ? matching.map((p) => p.id) : undefined;
  const noMatch = matching !== null && matching.length === 0;

  const filters = useMemo(
    () => ({
      part_ids: idFilter,
      storage_location_ids: locationId ? [locationId] : undefined,
      non_zero: true,
      page,
      per_page: PER_PAGE,
    }),
    [idFilter, locationId, page],
  );
  const { rows, meta, isLoading, isRefreshing, error, refresh } = useStockTotals(filters, !noMatch && !(q && searching), revision);

  const partsById = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const visible = useMemo(() => {
    if (!matching || idFilter) return rows;
    const ids = new Set(matching.map((p) => p.id));
    return rows.filter((r) => ids.has(r.partId));
  }, [rows, matching, idFilter]);

  const hasFilters = Boolean(q || locationId);
  const view = viewOf({ hasError: Boolean(error) && rows.length === 0, loading: isLoading && rows.length === 0 && !noMatch, empty: visible.length === 0 });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("storage.stock.searchPlaceholder")}
            aria-label={t("common.search")}
            className="h-9 ps-8"
          />
        </div>
        <Select value={locationId ? String(locationId) : ALL} onValueChange={(v) => onFiltersChange({ loc: v === ALL ? null : Number(v) })}>
          <SelectTrigger className="h-9 sm:w-56" aria-label={t("storage.stock.locationFilter")}>
            <Warehouse className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("storage.stock.allLocations")}</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => onFiltersChange({ q: null, loc: null })}>
            {t("common.clearAll")}
          </Button>
        )}
        {onAddPart && (
          <Button variant="outline" size="sm" className="h-9 sm:ms-auto" onClick={onAddPart}>
            <Plus className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t("storage.parts.addPart")}
          </Button>
        )}
      </div>

      {view === "error" && (
        <StorageErrorState message={error?.message} onRetry={() => void refresh()} />
      )}
      {view === "loading" && <StorageSkeleton />}
      {view === "empty" && (
        <StorageEmptyState
          icon={Package}
          description={hasFilters ? t("storage.stock.emptyFiltered") : t("storage.stock.empty")}
          action={
            hasFilters ? (
              <Button variant="outline" size="sm" onClick={() => onFiltersChange({ q: null, loc: null })}>
                {t("common.clearAll")}
              </Button>
            ) : undefined
          }
        />
      )}
      {view === "table" && (
        <>
          <div className={cn("overflow-x-auto rounded-md border bg-card", isRefreshing && "opacity-70")}>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>{t("storage.stock.part")}</th>
                  <th className={cn(TH, "text-end")}>{t("stock.onHand")}</th>
                  <th className={TH}>{t("storage.stock.where")}</th>
                  <th className={cn(TH, "text-end")}>{t("stock.value")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const part = partsById.get(row.partId);
                  const name = part?.name ?? row.part?.name ?? `#${row.partId}`;
                  const unit = vocabText(t, vocabEntry(PART_UNITS, part?.unit ?? "each"));
                  const hint = part ? partHint(part) : "";
                  return (
                    <tr
                      key={row.partId}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => onOpenPart(row.partId)}
                    >
                      <td className={TD}>
                        <button
                          type="button"
                          className="text-start text-sm font-medium hover:underline focus-visible:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPart(row.partId);
                          }}
                        >
                          {name}
                        </button>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          {hint && <span>{hint}</span>}
                          {part?.trackSerials && (
                            <Badge variant="outline" className="h-4 gap-0.5 px-1 text-[10px]">
                              <Hash className="h-2.5 w-2.5" aria-hidden="true" />
                              {t("storage.parts.serialBadge")}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className={cn(TD, "text-end")}>
                        <span className={cn("text-sm font-semibold tabular-nums", row.onHand < 0 && signTone(row.onHand))}>
                          {formatQuantity(row.onHand)}
                        </span>{" "}
                        <span className="text-[11px] text-muted-foreground">{unit}</span>
                        {row.onHand < 0 && <p className="text-[11px] text-red-600 dark:text-red-400">{t("storage.stock.short")}</p>}
                      </td>
                      <td className={TD}>
                        <ul className="space-y-1">
                          {row.locations.map((loc) => (
                            <LocationLine
                              key={loc.storageLocationId}
                              loc={loc}
                              unit={unit}
                              canSetSpot={canSetSpot && loc.stockBalanceId != null}
                              onSetSpot={() =>
                                setSpot({
                                  balanceId: loc.stockBalanceId as number,
                                  locationId: loc.storageLocationId,
                                  locationName: loc.storageLocation?.name ?? "",
                                  partName: name,
                                  current: loc.place,
                                })
                              }
                            />
                          ))}
                        </ul>
                      </td>
                      <td className={cn(TD, "text-end")}>
                        <span className="tabular-nums">{formatMoney(row.value)}</span>
                        {row.unknownCostQuantity != null && row.unknownCostQuantity > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="ms-1 inline-flex align-middle" onClick={(e) => e.stopPropagation()}>
                                <Info className="h-3 w-3 text-amber-600 dark:text-amber-400" aria-label={t("storage.stock.unknownCost")} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t("storage.stock.unknownCostHelp", { qty: formatQuantity(row.unknownCostQuantity), unit })}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {row.averageUnitCost != null && (
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {t("storage.stock.each", { cost: formatMoney(row.averageUnitCost) })}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {matching && !idFilter && <p className="text-[11px] text-muted-foreground">{t("storage.stock.broadSearch")}</p>}
          {meta && (
            <PaginationBar currentPage={meta.currentPage} lastPage={meta.lastPage} onPageChange={setPage} disabled={isRefreshing} />
          )}
        </>
      )}

      {spot && (
        <PlacePickerDialog
          open
          onOpenChange={(open) => !open && setSpot(null)}
          balanceId={spot.balanceId}
          locationId={spot.locationId}
          locationName={spot.locationName}
          partName={spot.partName}
          current={spot.current}
          canManage={canSetSpot}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  );
}

function LocationLine({
  loc,
  unit,
  canSetSpot,
  onSetSpot,
}: {
  loc: PartStockLocation;
  unit: string;
  canSetSpot: boolean;
  onSetSpot: () => void;
}) {
  const t = useTranslations("maintenanceSystem");
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="font-medium">{loc.storageLocation?.name ?? `#${loc.storageLocationId}`}</span>
      <PlaceBreadcrumb place={loc.place} />
      <span className={cn("ms-auto tabular-nums", loc.onHand < 0 && signTone(loc.onHand))}>
        {formatQuantity(loc.onHand)} {unit}
      </span>
      {canSetSpot && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onSetSpot();
          }}
          aria-label={t("storage.spot.setFor", { location: loc.storageLocation?.name ?? "" })}
        >
          <MapPin className="h-3 w-3" aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

/** Which of the four states the list is in (error and loading win over empty). */
function viewOf(s: { hasError: boolean; loading: boolean; empty: boolean }): "error" | "loading" | "empty" | "table" {
  if (s.hasError) return "error";
  if (s.loading) return "loading";
  if (s.empty) return "empty";
  return "table";
}
