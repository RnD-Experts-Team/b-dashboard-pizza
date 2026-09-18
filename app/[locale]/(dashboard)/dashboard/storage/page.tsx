"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Lock,
  Package,
  RefreshCw,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import {
  PageSection,
  SectionBreak,
  SectionDisclosure,
  SectionGroup,
} from "@/components/shared/page-section";
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

          {/*
            GROUP OF TWO: what we have, and what has moved. The two questions
            you come to this page with. Both PRIMARY, each with its own accent,
            so they are told apart at a glance rather than read.
          */}
          <SectionGroup>
          {canViewBalances && (
            <PageSection rank="primary" accent={1} icon={Package} title="What we have">

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
                  canSetPlace={canManageLocations}
                  hideEmpty={Boolean(partTotalFilters.non_zero)}
                  onHideEmptyChange={(value) =>
                    fetchPartTotals({ ...partTotalFilters, non_zero: value }, 1)
                  }
                />
              )}

              {/* The per-shelf view, one press away. Folded rather than gone:
                  "which shelf" is a real question, just not the first one.

                  It sits on its own rule with real space above it, because
                  pressed straight against the table it read as the table's
                  last row rather than as a control. */}
              <SectionDisclosure
                open={showByLocation}
                onToggle={() => setShowByLocation((v) => !v)}
                icon={Warehouse}
                label="Show it shelf by shelf"
              >
                <BalancesTab
                  data={balances}
                  isLoading={balancesLoading}
                  error={balancesError}
                  filters={balanceFilters}
                  onFiltersChange={(f, page) => fetchBalances(f, page)}
                  negativeOnly={negativeOnly}
                  onNegativeOnlyChange={setNegativeOnly}
                />
              </SectionDisclosure>
            </PageSection>
          )}

          {/* WHAT HAPPENED. The ledger, and the buttons that add to it. */}
          {canViewMovements && (
            <PageSection
              rank="primary"
              accent={2}
              icon={ArrowLeftRight}
              title="What has gone in and out"
            >
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
            </PageSection>
          )}
          </SectionGroup>

          {/* THE BREAK. Everything above is what you came for; everything below
              is housekeeping. Landing anywhere on this page, which side of this
              line you are on tells you which. */}
          <SectionBreak />


          {/* WHERE WE KEEP IT. TERTIARY: about four of these, changing about
              once a year. It is settings, sitting on the page rather than
              behind a tab so it can still be found -- but it does not compete
              with the two sections above. */}
          {canViewLocations && (
            <PageSection rank="tertiary">
              {/* The header IS the toggle. Quiet, but bounded -- the dashed
                  edge of the tertiary shell gives it a visible start and end,
                  which a bare `bg-muted/20` never did. */}
              <button
                type="button"
                onClick={() => setShowLocations((v) => !v)}
                aria-expanded={showLocations}
                className="-m-1 flex h-9 w-full items-center gap-2 rounded-md p-1 text-start transition-colors hover:bg-accent"
              >
                {showLocations ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <Warehouse className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Where we keep things
                </span>
                {locations?.meta.total != null && (
                  <span className="text-xs text-muted-foreground">
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
                  className="mt-3 border-t pt-3"
                />
              )}
            </PageSection>
          )}

        </>
      )}
    </div>
  );
}
