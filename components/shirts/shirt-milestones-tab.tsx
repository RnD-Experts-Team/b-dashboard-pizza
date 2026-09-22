"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Palette, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  hasRealShirtFulfilmentAccess,
} from "@/lib/auth/shirt-access";
import type { ShirtAction } from "@/lib/shirts/shirt-utils";
import { ShirtEmptyState } from "@/components/shirts/shirt-ui";
import { ShirtQueue } from "@/components/shirts/shirt-queue";
import { ShirtEntryDialog } from "@/components/shirts/shirt-entry-dialog";
import { ShirtActionDialog } from "@/components/shirts/shirt-action-dialog";
import type { ShirtActionMode } from "@/components/shirts/shirt-action-dialog";
import { ShirtMilestoneSheet } from "@/components/shirts/shirt-milestone-sheet";
import { ShirtHistoryDialog } from "@/components/shirts/shirt-history-dialog";
import { ShirtCatalogDialog } from "@/components/shirts/shirt-catalog-dialog";
import type { ShirtMilestone } from "@/types/shirt-milestone.types";

const STORE_FILTER_KEY = "store-filter:shirt-milestones";

export interface ShirtMilestonesTabProps {
  active?: boolean;
}

/**
 * The Shirt Milestones tab: one queue plus the dialogs it drives.
 *
 * There is deliberately no store-vs-fulfilment sub-view. Both are the same
 * rows of the same entity; the only real differences are which endpoint can
 * serve them and which actions the viewer may take, and those are settled by
 * shirt-access.ts and by status x permission per row. Splitting them into
 * tabs would have shown a switch to almost nobody (a super admin, or an
 * Employee Obsession user who also manages stores) while making everyone else
 * read a nested tab strip for a single list.
 */
export function ShirtMilestonesTab({ active = true }: ShirtMilestonesTabProps) {
  const { canAccessRoute, hasAnyRole, isSuperAdmin, overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;

  const shirtAuth = useMemo(
    () => ({ canAccessRoute, hasAnyRole }),
    [canAccessRoute, hasAnyRole],
  );

  const canStoreQueue = canAccessShirtView("store_queue", shirtAuth, effectiveStoreId);
  const canFulfilmentView = canAccessShirtView("fulfilment", shirtAuth);
  const canFulfil = canFulfilShirtMilestone(shirtAuth);
  const canFill = canFillShirtEntry(shirtAuth, effectiveStoreId);
  const canCreate = canCreateManualShirtMilestone(shirtAuth, effectiveStoreId);
  const canCatalog = canManageShirtCatalog(shirtAuth);

  /* Which endpoint the queue reads. Deliberately NOT canFulfilmentView, which
     a super admin passes by bypass — see hasRealShirtFulfilmentAccess. */
  const crossStore = hasRealShirtFulfilmentAccess({
    canAccessRoute,
    hasAnyRole,
    isSuperAdmin,
  });

  const perms = useMemo(() => ({ canFill, canFulfil }), [canFill, canFulfil]);

  // Neither path available — say so rather than rendering an empty tab.
  const noAccess = !canStoreQueue && !canFulfilmentView;

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

  const storeOptions = useMemo(
    () =>
      (overviewStores ?? []).flatMap((s) =>
        s.storeId ? [{ storeId: s.storeId, name: s.name }] : [],
      ),
    [overviewStores],
  );

  /* ── Deep link from a shirt_milestone_* notification ───────────────────── */

  const pendingHiringAction = useHiringActionStore((s) => s.pendingHiringAction);
  const clearPendingHiringAction = useHiringActionStore(
    (s) => s.clearPendingHiringAction,
  );
  const [pendingHighlightId, setPendingHighlightId] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const [rows, setRows] = useState<ShirtMilestone[]>([]);
  const [queueLoaded, setQueueLoaded] = useState(false);

  // Effect A: narrow to the notification's store when it is one of ours, then
  // stash the target id. A cross-store reader needs no narrowing to find it.
  useEffect(() => {
    if (!pendingHiringAction || pendingHiringAction.tab !== "shirt_milestones") return;
    if (validStoreIds.has(pendingHiringAction.storeNumber)) {
      handleStoreApply([pendingHiringAction.storeNumber]);
    }
    setPendingHighlightId(pendingHiringAction.requestId);
    clearPendingHiringAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHiringAction, validStoreIds, clearPendingHiringAction]);

  // Effect B: once the rows land, ring the target row briefly.
  useEffect(() => {
    if (pendingHighlightId === null || !queueLoaded) return;
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
  }, [rows, pendingHighlightId, queueLoaded]);

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
  }>({ open: false, storeNumber: "", employeeId: null });

  const [catalogOpen, setCatalogOpen] = useState(false);

  const handleAction = useCallback((action: ShirtAction, m: ShirtMilestone) => {
    if (action === "entry") {
      // The entry endpoint is store-scoped; every row carries its store number,
      // so this works identically from either data source.
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

  return (
    <div className="flex flex-col gap-4">
      {/* Actions row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {storeOptions.length > 0 ? (
          <StoreMultiSelect
            stores={storeOptions}
            value={selectedStoreIds}
            onApply={handleStoreApply}
          />
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={refresh} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canCatalog && (
            <Button variant="outline" onClick={() => setCatalogOpen(true)}>
              <Palette className="me-2 h-4 w-4" />
              <span className="hidden sm:inline">Manage Catalog</span>
              <span className="sm:hidden">Catalog</span>
            </Button>
          )}
          {canCreate && selectedStoreIds.length > 0 && (
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
        <ShirtEmptyState>You do not have access to shirt milestones.</ShirtEmptyState>
      ) : (
        <ShirtQueue
          active={active}
          storeNumbers={selectedStoreIds}
          crossStore={crossStore}
          highlightId={highlightId}
          perms={perms}
          refreshToken={refreshToken}
          onOpen={handleOpenSheet}
          onAction={handleAction}
          onViewHistory={handleViewHistory}
          onLoadedChange={setQueueLoaded}
          onRowsChange={setRows}
        />
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
      />

      <ShirtCatalogDialog open={catalogOpen} onOpenChange={setCatalogOpen} />
    </div>
  );
}
