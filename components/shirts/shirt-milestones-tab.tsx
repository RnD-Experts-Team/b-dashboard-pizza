"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Palette, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StoreMultiSelect } from "@/components/hiring/store-multi-select";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useHiringActionStore } from "@/lib/store/hiring-action.store";
import {
  canAccessShirtView,
  canCreateManualShirtMilestone,
  canFillShirtEntry,
  canFulfilShirtMilestone,
  canManageShirtCatalog,
} from "@/lib/auth/shirt-access";
import type { ShirtAction } from "@/lib/shirts/shirt-utils";
import { ShirtEmptyState } from "@/components/shirts/shirt-ui";
import { ShirtStoreQueue } from "@/components/shirts/shirt-store-queue";
import { ShirtFulfilmentQueue } from "@/components/shirts/shirt-fulfilment-queue";
import { ShirtEntryDialog } from "@/components/shirts/shirt-entry-dialog";
import { ShirtActionDialog } from "@/components/shirts/shirt-action-dialog";
import type { ShirtActionMode } from "@/components/shirts/shirt-action-dialog";
import { ShirtMilestoneSheet } from "@/components/shirts/shirt-milestone-sheet";
import { ShirtHistoryDialog } from "@/components/shirts/shirt-history-dialog";
import { ShirtCatalogDialog } from "@/components/shirts/shirt-catalog-dialog";
import type { ShirtMilestone } from "@/types/shirt-milestone.types";

const STORE_FILTER_KEY = "store-filter:shirt-milestones";

export type ShirtViewKey = "store_queue" | "fulfilment";

export interface ShirtMilestonesTabProps {
  active?: boolean;
  initialView?: ShirtViewKey;
  /** True when rendered on its own, outside the page's <Tabs>. */
  solo?: boolean;
}

/**
 * The Shirt Milestones tab: a store queue, an HQ fulfilment queue, and the
 * dialogs both share.
 *
 * Which sub-views appear is derived here from lib/auth/shirt-access.ts rather
 * than passed in, so the page does not have to know the feature's permission
 * shape.
 */
export function ShirtMilestonesTab({
  active = true,
  initialView,
  solo = false,
}: ShirtMilestonesTabProps) {
  const { canAccessRoute, hasAnyRole, overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;

  const shirtAuth = useMemo(
    () => ({ canAccessRoute, hasAnyRole }),
    [canAccessRoute, hasAnyRole],
  );

  const canStoreQueue = canAccessShirtView("store_queue", shirtAuth, effectiveStoreId);
  const canFulfil = canFulfilShirtMilestone(shirtAuth);
  const canFulfilmentView = canAccessShirtView("fulfilment", shirtAuth);
  const canFill = canFillShirtEntry(shirtAuth, effectiveStoreId);
  const canCreate = canCreateManualShirtMilestone(shirtAuth, effectiveStoreId);
  const canCatalog = canManageShirtCatalog(shirtAuth);

  const perms = useMemo(() => ({ canFill, canFulfil }), [canFill, canFulfil]);

  const [view, setView] = useState<ShirtViewKey>(
    initialView ?? (canStoreQueue ? "store_queue" : "fulfilment"),
  );
  const showViewSwitch = canStoreQueue && canFulfilmentView && !solo;

  /* ── Store filter ──────────────────────────────────────────────────────── */

  const validStoreIds = useMemo(
    () => new Set((overviewStores ?? []).flatMap((s) => (s.storeId ? [s.storeId] : []))),
    [overviewStores],
  );

  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(() => {
    const valid = new Set(
      (overviewStores ?? []).flatMap((s) => (s.storeId ? [s.storeId] : [])),
    );
    const fallback = [...valid];
    try {
      const raw = localStorage.getItem(STORE_FILTER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clamped = (parsed as string[]).filter((id) => valid.has(id));
          if (clamped.length > 0) return clamped;
        }
      }
    } catch {}
    return fallback;
  });

  useEffect(() => {
    if (validStoreIds.size === 0) return;
    setSelectedStoreIds((prev) => {
      const clamped = prev.filter((id) => validStoreIds.has(id));
      return clamped.length > 0 ? clamped : [...validStoreIds];
    });
  }, [validStoreIds]);

  const handleStoreApply = useCallback((ids: string[]) => {
    setSelectedStoreIds(ids);
    try {
      localStorage.setItem(STORE_FILTER_KEY, JSON.stringify(ids));
    } catch {}
  }, []);

  /* ── Deep link from a shirt_milestone_* notification ───────────────────── */

  const pendingHiringAction = useHiringActionStore((s) => s.pendingHiringAction);
  const clearPendingHiringAction = useHiringActionStore(
    (s) => s.clearPendingHiringAction,
  );
  const [pendingHighlightId, setPendingHighlightId] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const [rows, setRows] = useState<ShirtMilestone[]>([]);
  const [storeQueueLoaded, setStoreQueueLoaded] = useState(false);

  // Effect A: point the view at the right place and stash the target id.
  useEffect(() => {
    if (!pendingHiringAction || pendingHiringAction.tab !== "shirt_milestones") return;

    if (validStoreIds.has(pendingHiringAction.storeNumber) && canStoreQueue) {
      setView("store_queue");
      handleStoreApply([pendingHiringAction.storeNumber]);
    } else if (canFulfilmentView) {
      // An HQ user has no overviewStores entry for the store, so falling back
      // to the fulfilment view is better than dropping the notification.
      setView("fulfilment");
    } else {
      clearPendingHiringAction();
      return;
    }

    setPendingHighlightId(pendingHiringAction.requestId);
    clearPendingHiringAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHiringAction, validStoreIds, clearPendingHiringAction]);

  // Effect B: once the rows land, ring the target row briefly.
  useEffect(() => {
    if (pendingHighlightId === null || !storeQueueLoaded) return;
    const target = rows.find((r) => r.id === pendingHighlightId);
    setPendingHighlightId(null);
    if (!target) return;

    setHighlightId(target.id);
    if (highlightTimeoutRef.current != null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightId(null);
      highlightTimeoutRef.current = null;
    }, 1500);
  }, [rows, pendingHighlightId, storeQueueLoaded]);

  useEffect(
    () => () => {
      if (highlightTimeoutRef.current != null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    },
    [],
  );

  /* ── Dialogs ───────────────────────────────────────────────────────────── */

  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  const [sheetMilestone, setSheetMilestone] = useState<ShirtMilestone | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [entryDialog, setEntryDialog] = useState<{
    open: boolean;
    mode: "entry" | "create";
    milestone: ShirtMilestone | null;
    storeNumber: string;
  }>({ open: false, mode: "entry", milestone: null, storeNumber: "" });

  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    mode: ShirtActionMode;
    milestone: ShirtMilestone | null;
  }>({ open: false, mode: "order", milestone: null });

  const [historyDialog, setHistoryDialog] = useState<{
    open: boolean;
    storeNumber: string;
    employeeId: number | null;
    employeeName?: string;
  }>({ open: false, storeNumber: "", employeeId: null });

  const [catalogOpen, setCatalogOpen] = useState(false);

  const handleAction = useCallback((action: ShirtAction, m: ShirtMilestone) => {
    if (action === "entry") {
      setEntryDialog({
        open: true,
        mode: "entry",
        milestone: m,
        storeNumber: m.store?.store_number ?? "",
      });
      return;
    }
    setActionDialog({ open: true, mode: action, milestone: m });
  }, []);

  const handleViewHistory = useCallback((m: ShirtMilestone) => {
    setHistoryDialog({
      open: true,
      storeNumber: m.store?.store_number ?? "",
      employeeId: m.employee_id,
    });
  }, []);

  const handleOpenSheet = useCallback((m: ShirtMilestone) => {
    setSheetMilestone(m);
    setSheetOpen(true);
  }, []);

  const storeOptions = useMemo(
    () =>
      (overviewStores ?? []).flatMap((s) =>
        s.storeId ? [{ storeId: s.storeId, name: s.name }] : [],
      ),
    [overviewStores],
  );

  // Neither view accessible — say so rather than rendering an empty tab. The
  // store queue's fail-soft requirement makes this rare, but a user with no
  // matching auth rule and no role would otherwise just see blank space.
  const noAccess = !canStoreQueue && !canFulfilmentView;

  const queues = (
    <>
      {canStoreQueue && (view === "store_queue" || !showViewSwitch) && (
        <ShirtStoreQueue
          active={active && view === "store_queue"}
          storeNumbers={selectedStoreIds}
          highlightId={highlightId}
          perms={perms}
          refreshToken={refreshToken}
          onOpen={handleOpenSheet}
          onAction={handleAction}
          onViewHistory={handleViewHistory}
          onLoadedChange={setStoreQueueLoaded}
          onRowsChange={setRows}
        />
      )}
      {canFulfilmentView && view === "fulfilment" && (
        <ShirtFulfilmentQueue
          active={active && view === "fulfilment"}
          highlightId={highlightId}
          perms={perms}
          refreshToken={refreshToken}
          onOpen={handleOpenSheet}
          onAction={handleAction}
          onViewHistory={handleViewHistory}
        />
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Actions row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {view === "store_queue" && canStoreQueue ? (
          <StoreMultiSelect
            stores={storeOptions}
            value={selectedStoreIds}
            onApply={handleStoreApply}
          />
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canCatalog && (
            <Button variant="outline" onClick={() => setCatalogOpen(true)}>
              <Palette className="me-2 h-4 w-4" />
              <span className="hidden sm:inline">Manage Catalog</span>
              <span className="sm:hidden">Catalog</span>
            </Button>
          )}
          {canCreate && canStoreQueue && (
            <Button
              onClick={() =>
                setEntryDialog({
                  open: true,
                  mode: "create",
                  milestone: null,
                  storeNumber: selectedStoreIds[0] ?? "",
                })
              }
            >
              <Plus className="me-2 h-4 w-4" />
              <span className="hidden sm:inline">New Entry</span>
              <span className="sm:hidden">New</span>
            </Button>
          )}
        </div>
      </div>

      {noAccess ? (
        <ShirtEmptyState>
          You do not have access to shirt milestones.
        </ShirtEmptyState>
      ) : showViewSwitch ? (
        <Tabs value={view} onValueChange={(v) => setView(v as ShirtViewKey)}>
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
            <TabsTrigger value="store_queue">My Stores</TabsTrigger>
            <TabsTrigger value="fulfilment">Fulfilment</TabsTrigger>
          </TabsList>
          <TabsContent value="store_queue" className="mt-4" tabIndex={-1}>
            {view === "store_queue" && queues}
          </TabsContent>
          <TabsContent value="fulfilment" className="mt-4" tabIndex={-1}>
            {view === "fulfilment" && queues}
          </TabsContent>
        </Tabs>
      ) : (
        queues
      )}

      <ShirtMilestoneSheet
        milestone={sheetMilestone}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        perms={perms}
        onAction={(action, m) => {
          setSheetOpen(false);
          handleAction(action, m);
        }}
        onViewHistory={(m) => {
          setSheetOpen(false);
          handleViewHistory(m);
        }}
      />

      <ShirtEntryDialog
        open={entryDialog.open}
        onOpenChange={(o) => setEntryDialog((p) => ({ ...p, open: o }))}
        mode={entryDialog.mode}
        storeNumber={entryDialog.storeNumber}
        milestone={entryDialog.milestone}
        storeOptions={storeOptions}
        onSuccess={refresh}
      />

      <ShirtActionDialog
        open={actionDialog.open}
        onOpenChange={(o) => setActionDialog((p) => ({ ...p, open: o }))}
        mode={actionDialog.mode}
        milestone={actionDialog.milestone}
        onSuccess={refresh}
        onStale={refresh}
      />

      <ShirtHistoryDialog
        open={historyDialog.open}
        onOpenChange={(o) => setHistoryDialog((p) => ({ ...p, open: o }))}
        storeNumber={historyDialog.storeNumber}
        employeeId={historyDialog.employeeId}
        employeeName={historyDialog.employeeName}
      />

      <ShirtCatalogDialog open={catalogOpen} onOpenChange={setCatalogOpen} />
    </div>
  );
}
