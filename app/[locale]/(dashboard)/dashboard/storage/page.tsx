"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Lock, RefreshCw, Scale, Warehouse, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { StorageKpis } from "@/components/storage/storage-kpis";
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

type StorageTabId = "balances" | "movements" | "locations";

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

  const [activeTab, setActiveTab] = useState<StorageTabId>("balances");
  const [negativeOnly, setNegativeOnly] = useState(false);

  const visibleTabs = useMemo(() => {
    const defs: {
      id: StorageTabId;
      label: string;
      icon: LucideIcon;
      visible: boolean;
    }[] = [
      // Balances first: it answers "what do we have", and it is the read-only
      // surface that proves the whole pipe end to end.
      { id: "balances", label: "Balances", icon: Scale, visible: canViewBalances },
      {
        id: "movements",
        label: "Movements",
        icon: ArrowLeftRight,
        visible: canViewMovements,
      },
      { id: "locations", label: "Locations", icon: Warehouse, visible: canViewLocations },
    ];
    return defs.filter((d) => d.visible);
  }, [canViewBalances, canViewMovements, canViewLocations]);

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storage & Stock"
        description="Locations, the stock movement ledger, and on-hand balances."
      >
        <Button variant="outline" size="sm" onClick={refetchAll} disabled={isRefreshing}>
          <RefreshCw className={cn("me-2 h-4 w-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </PageHeader>

      {visibleTabs.length === 0 ? (
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
            trackedPairs={balances?.meta.total ?? null}
            locationCount={locations?.meta.total ?? null}
            movementCount={movements?.meta.total ?? null}
            negatives={negativeScan?.rows ?? null}
            scanned={negativeScan?.scanned}
            scanTotal={negativeScan?.total}
            isLoading={balancesLoading && !balances}
            onNegativesClick={() => {
              setNegativeOnly(true);
              setActiveTab("balances");
            }}
          />

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as StorageTabId)}
            className="w-full"
          >
            <div className="-mx-1 overflow-x-auto px-1">
              <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
                {visibleTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="gap-2 whitespace-nowrap"
                  >
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {canViewBalances && (
              <TabsContent value="balances" className="mt-4">
                <BalancesTab
                  data={balances}
                  isLoading={balancesLoading}
                  error={balancesError}
                  filters={balanceFilters}
                  onFiltersChange={(f, page) => fetchBalances(f, page)}
                  negativeOnly={negativeOnly}
                  onNegativeOnlyChange={setNegativeOnly}
                />
              </TabsContent>
            )}

            {canViewMovements && (
              <TabsContent value="movements" className="mt-4">
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
              </TabsContent>
            )}

            {canViewLocations && (
              <TabsContent value="locations" className="mt-4">
                <LocationsTab
                  data={locations}
                  isLoading={locationsLoading}
                  error={locationsError}
                  filters={locationFilters}
                  onFiltersChange={(f, page) => fetchLocations(f, page)}
                  canManage={canManageLocations}
                  onChanged={() => fetchLocations(locationFilters, locationFilters.page ?? 1)}
                />
              </TabsContent>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}
