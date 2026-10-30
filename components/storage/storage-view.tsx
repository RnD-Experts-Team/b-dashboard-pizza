"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth/use-auth";
import { usePartsCatalog, useStorageLocationList } from "@/lib/hooks/use-storage";
import type { StockActionId } from "@/lib/storage/stock-actions";
import {
  STORAGE_TABS,
  TAB_PARAM_KEYS,
  countStatusParam,
  idParam,
  parseStorageTab,
  patchParams,
  readMovementFilters,
  type ParamPatch,
} from "@/lib/storage/storage-url";
import { CountsTab } from "./counts-tab";
import { LocationsTab } from "./locations-tab";
import { MovementsTab } from "./movements-tab";
import { PartFormDialog } from "./part-form-dialog";
import { PartSheet } from "./part-sheet";
import { RecordStockMenu, StockActionHost, type PendingStockAction } from "./record-stock-menu";
import { StockTab } from "./stock-tab";
import type { Part } from "@/types/maintenance-v2";

/**
 * Storage (docs/MAINTENANCE-V2-UI.md §6): Stock · Movements · Stock counts ·
 * Locations, `?tab=` and each tab's filters in the URL. The one primary
 * action is "Record stock" (Stock and Movements); the other tabs carry their
 * own (Start a count, Add location).
 *
 * GLOBAL, not store-scoped: no permission probe passes a store id.
 */

const MAINTENANCE = "Maintenance";

export function StorageView() {
  const t = useTranslations("maintenanceV2");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { canAccessRoute } = useAuth();

  const can = (method: string, path: string) => canAccessRoute({ service: MAINTENANCE, method, path });
  const canRecordMovements = can("POST", "/stock-movements");
  const canRecordPayments = can("POST", "/payments");
  const canMarkMistaken = can("POST", "/stock-movements/*/mistaken");
  const canManageLocations = can("POST", "/storage-locations");
  const canEditParts = can("PATCH", "/parts/*");
  const canAddParts = can("POST", "/parts");
  const canStartCount = can("POST", "/stock-counts");

  const tab = parseStorageTab(params.get("tab"));
  const { parts, isLoading: partsLoading, refresh: refreshParts, setData: setParts } = usePartsCatalog();
  const locationList = useStorageLocationList();
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<PendingStockAction | null>(null);
  const [addingPart, setAddingPart] = useState(false);

  const bump = useCallback(() => setRevision((r) => r + 1), []);

  const setParams = useCallback(
    (patch: ParamPatch, mode: "push" | "replace" = "replace") => {
      const qs = patchParams(new URLSearchParams(params.toString()), patch);
      const url = `${pathname}${qs}`;
      if (mode === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [params, pathname, router],
  );

  const changeTab = (next: string) => {
    const target = parseStorageTab(next);
    const cleared = Object.fromEntries(
      STORAGE_TABS.filter((name) => name !== target).flatMap((name) => TAB_PARAM_KEYS[name].map((key) => [key, null])),
    );
    setParams({ ...cleared, tab: target === "stock" ? null : target }, "push");
  };

  const openPartId = idParam(params.get("p")) ?? null;
  const movementFilters = useMemo(() => readMovementFilters(params), [params]);

  const onPartSaved = (saved: Part) => {
    setParts((prev) => {
      const list = prev ?? [];
      return list.some((p) => p.id === saved.id) ? list.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...list];
    });
    void refreshParts();
    bump();
  };

  const pick = (id: StockActionId, partId?: number) => setPending({ id, prefill: partId ? { partId } : undefined });
  const stockLocationFilter = tab === "stock" ? idParam(params.get("loc")) : undefined;

  const recordMenu =
    tab === "stock" || tab === "movements" ? (
      <RecordStockMenu onPick={(id) => pick(id)} canRecordMovements={canRecordMovements} canRecordPayments={canRecordPayments} />
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader title={t("pages.storage")} description={t("storage.page.description")}>
        {recordMenu}
      </PageHeader>

      <Tabs value={tab} onValueChange={changeTab}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
            {STORAGE_TABS.map((name) => (
              <TabsTrigger key={name} value={name}>
                {t(`stock.tabs.${name}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="stock" className="mt-4">
          {tab === "stock" && (
            <StockTab
              search={params.get("q") ?? ""}
              locationId={stockLocationFilter}
              onFiltersChange={setParams}
              parts={parts}
              partsLoading={partsLoading}
              locations={locationList.all}
              onOpenPart={(id) => setParams({ p: id }, "push")}
              onAddPart={canAddParts ? () => setAddingPart(true) : undefined}
              canSetSpot={canManageLocations}
              revision={revision}
            />
          )}
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          {tab === "movements" && (
            <MovementsTab
              filters={movementFilters}
              onFiltersChange={setParams}
              parts={parts}
              locations={locationList.all}
              canMarkMistaken={canMarkMistaken}
              revision={revision}
              onChanged={bump}
            />
          )}
        </TabsContent>

        <TabsContent value="counts" className="mt-4">
          {tab === "counts" && (
            <CountsTab
              locationId={idParam(params.get("loc"))}
              status={countStatusParam(params.get("status"))}
              onFiltersChange={setParams}
              locations={locationList.all}
              liveLocations={locationList.live}
              canStart={canStartCount}
              revision={revision}
            />
          )}
        </TabsContent>

        <TabsContent value="locations" className="mt-4">
          {tab === "locations" && (
            <LocationsTab
              locations={locationList.all}
              isLoading={locationList.isLoading}
              error={locationList.error}
              onRetry={() => void locationList.refresh()}
              selectedId={idParam(params.get("location"))}
              onSelect={(id) => setParams({ location: id })}
              canManage={canManageLocations}
              onChanged={() => void locationList.refresh()}
            />
          )}
        </TabsContent>
      </Tabs>

      <PartSheet
        partId={openPartId}
        onOpenChange={(open) => !open && setParams({ p: null })}
        parts={parts}
        onPartSaved={onPartSaved}
        onRecord={(id, partId) => pick(id, partId)}
        canEdit={canEditParts}
        canRecordMovements={canRecordMovements}
        canRecordPayments={canRecordPayments}
        revision={revision}
      />

      <PartFormDialog
        open={addingPart}
        onOpenChange={setAddingPart}
        catalog={parts}
        onSaved={(saved) => {
          onPartSaved(saved);
          setParams({ p: saved.id }, "push");
        }}
      />

      <StockActionHost
        pending={pending}
        onClose={() => setPending(null)}
        parts={parts}
        locations={locationList.live}
        defaultLocationId={stockLocationFilter}
        canDeclareSpots={canManageLocations}
        onRecorded={() => {
          setPending(null);
          bump();
        }}
      />
    </div>
  );
}
