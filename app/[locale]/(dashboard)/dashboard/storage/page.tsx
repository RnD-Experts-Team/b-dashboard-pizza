"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Lock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { StorageKpis } from "@/components/storage/storage-kpis";
import { PartStockList } from "@/components/storage/part-stock-list";
import { StorageSkeleton, StorageErrorCard } from "@/components/storage/storage-shared";
import { BalancesTab } from "@/components/storage/balances-tab";
import { MovementsTab } from "@/components/storage/movements-tab";
import { LocationsTab } from "@/components/storage/locations-tab";
import { useStorage } from "@/lib/hooks/use-storage";
import { useAuth } from "@/lib/auth/use-auth";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Storage & Stock                                                          */
/*                                                                            */
/*  GLOBAL, not store-scoped — note that no permission probe below passes a   */
/*  storeId. That is deliberate; these endpoints have no store segment.      */
/*                                                                            */
/*  No loading.tsx / error.tsx sibling: the segment-level ones already cover  */
/*  every child, no other dashboard page defines its own, and this page is a  */
/*  client component with its own skeleton ladder — a segment loader would    */
/*  only flash.                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/*
 * ONE PAGE, NO TABS.
 *
 * This was three tabs -- Balances, Movements, Locations -- and the landing tab
 * was read-only, so recording anything began with finding the right tab first.
 * Tabs hide things, and the rule for this whole feature is that nothing the
 * coordinator needs should be hidden.
 *
 * So it reads top to bottom in the order the questions get asked: what have we
 * got, what happened, and (folded away, because four of them change about once
 * a year) where we keep it.
 */

export default function StoragePage() {
  const { canAccessRoute } = useAuth();

  const canViewBalances = canAccessRoute({
    service: "Maintenance",
    method: "GET",
    path: "/stock-balances",
  });
  const canViewMovements = canAccessRoute({
    service: "Maintenance",
    method: "GET",
    path: "/stock-movements",
  });
  const canCreateMovement = canAccessRoute({
    service: "Maintenance",
    method: "POST",
    path: "/stock-movements",
  });
  const canViewLocations = canAccessRoute({
    service: "Maintenance",
    method: "GET",
    path: "/storage-locations",
  });
  const canManageLocations = canAccessRoute({
    service: "Maintenance",
    method: "POST",
    path: "/storage-locations",
  });

  const {
    movements,
    movementsLoading,
    movementsError,
    movementFilters,
    fetchMovements,
    balances,
    balancesLoading,
    balancesError,
    balanceFilters,
    fetchBalances,
    partTotals,
    partTotalsLoading,
    partTotalsRefreshing,
    partTotalsError,
    partTotalFilters,
    fetchPartTotals,
    locations,
    locationsLoading,
    locationsError,
    locationFilters,
    fetchLocations,
    parts,
    allLocations,
    liveLocations,
    negativeScan,
    isRefreshing,
    refetchAll,
    refetchAfterWrite,
  } = useStorage();

  const [negativeOnly, setNegativeOnly] = useState(false);
  /** The per-shelf ledger view, folded away by default: the totals above answer
   *  the usual question, and this answers "which shelf" when it comes up. */
  const [showByLocation, setShowByLocation] = useState(false);
  /** Four locations that change about once a year do not earn permanent space. */
  const [showLocations, setShowLocations] = useState(false);

  /** Nothing at all is permitted -- distinct from "permitted but empty". */
  const hasAnyAccess = canViewBalances || canViewMovements || canViewLocations;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storage"
        description="What we have, where it is, and everything that has gone in or out."
      >
        <Button variant="outline" size="sm" onClick={refetchAll} disabled={isRefreshing}>
          <RefreshCw className={cn("me-2 h-4 w-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </PageHeader>

      {!hasAnyAccess ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">No access to storage</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Your role does not include the storage and stock endpoints. Ask an
              administrator if you need them.
            </p>
          </div>
        </div>
      ) : (
        <>
          <StorageKpis
            trackedPairs={partTotals?.meta.total ?? null}
            locationCount={locations?.meta.total ?? null}
            movementCount={movements?.meta.total ?? null}
            negatives={negativeScan?.rows ?? null}
            scanned={negativeScan?.scanned}
            scanTotal={negativeScan?.total}
            isLoading={partTotalsLoading && !partTotals}
            onNegativesClick={() => {
              // Negatives live per shelf, not per part -- a part can be fine
              // overall and still be short somewhere -- so this opens the
              // per-location view rather than filtering the totals.
              setNegativeOnly(true);
              setShowByLocation(true);
            }}
          />

          {/* WHAT WE HAVE. One row per part, totalled across every location,
              which is the number people came here for and the one the old
              layout never showed. */}
          {canViewBalances && (
            <section className="space-y-3">
              <h2 className="font-heading text-sm font-semibold">What we have</h2>

              {partTotalsError && !partTotals ? (
                <StorageErrorCard
                  error={partTotalsError}
                  onRetry={() => fetchPartTotals(partTotalFilters, partTotalFilters.page ?? 1)}
                />
              ) : partTotalsLoading && !partTotals ? (
                <StorageSkeleton />
              ) : (
                <PartStockList
                  data={partTotals}
                  isLoading={partTotalsLoading}
                  isRefreshing={partTotalsRefreshing}
                  page={partTotalFilters.page ?? 1}
                  onPageChange={(page) => fetchPartTotals(partTotalFilters, page)}
                  hideEmpty={Boolean(partTotalFilters.non_zero)}
                  onHideEmptyChange={(value) =>
                    fetchPartTotals({ ...partTotalFilters, non_zero: value }, 1)
                  }
                />
              )}

              {/* The per-shelf view, one press away. Folded rather than gone:
                  "which shelf" is a real question, just not the first one. */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowByLocation((v) => !v)}
                  aria-expanded={showByLocation}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showByLocation ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  Show it shelf by shelf
                </button>
                {showByLocation && (
                  <div className="mt-3">
                    <BalancesTab
                      data={balances}
                      isLoading={balancesLoading}
                      error={balancesError}
                      filters={balanceFilters}
                      onFiltersChange={(f, page) => fetchBalances(f, page)}
                      negativeOnly={negativeOnly}
                      onNegativeOnlyChange={setNegativeOnly}
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* WHAT HAPPENED. The ledger, and the buttons that add to it. */}
          {canViewMovements && (
            <section className="space-y-3">
              <h2 className="font-heading text-sm font-semibold">What has gone in and out</h2>
              <MovementsTab
                data={movements}
                isLoading={movementsLoading}
                error={movementsError}
                filters={movementFilters}
                onFiltersChange={(f, page) => fetchMovements(f, page)}
                parts={parts}
                allLocations={allLocations}
                liveLocations={liveLocations}
                canCreate={canCreateMovement}
                onChanged={refetchAfterWrite}
              />
            </section>
          )}

          {/* WHERE WE KEEP IT. Folded: about four of these, changing about once
              a year. It is settings, sitting on the page rather than behind a
              tab so it can still be found. */}
          {canViewLocations && (
            <section className="space-y-3">
              <button
                type="button"
                onClick={() => setShowLocations((v) => !v)}
                aria-expanded={showLocations}
                className="flex items-center gap-1.5 font-heading text-sm font-semibold transition-colors hover:text-muted-foreground"
              >
                {showLocations ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Where we keep things
                {locations?.meta.total != null && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({locations.meta.total})
                  </span>
                )}
              </button>
              {showLocations && (
                <LocationsTab
                  data={locations}
                  isLoading={locationsLoading}
                  error={locationsError}
                  filters={locationFilters}
                  onFiltersChange={(f, page) => fetchLocations(f, page)}
                  canManage={canManageLocations}
                  onChanged={() => fetchLocations(locationFilters, locationFilters.page ?? 1)}
                />
              )}
            </section>
          )}

        </>
      )}
    </div>
  );
}
