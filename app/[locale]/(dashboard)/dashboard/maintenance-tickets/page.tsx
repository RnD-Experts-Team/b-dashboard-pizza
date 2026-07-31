"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import {
  TicketsSkeleton,
  TicketsEmptyState,
  TicketsErrorCard,
  TicketsTable,
  TicketsFiltersBar,
  TicketsAnalyticsPanel,
  CreateTicketDialog,
  TicketDetailSheet,
  CatalogManagementDialog,
} from "@/components/maintenance-tickets";
import { useMaintenanceTickets } from "@/lib/hooks/use-maintenance-tickets";
import { useAuth } from "@/lib/auth/use-auth";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { Ticket } from "@/types/maintenance-tickets.types";

export default function MaintenanceTicketsPage() {
  const t = useTranslations("maintenanceTickets");
  const { canAccessRoute } = useAuth();
  const { overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();

  // ─── Auth checks ──────────────────────────────────────────────────────────
  const canAccessCatalog = canAccessRoute({
    service: "Maintenance",
    method: "POST",
    path: "/technicians",
  });

  const canCancelTicket = canAccessRoute({
    service: "Maintenance",
    method: "POST",
    path: "/stores/placeholder/tickets/placeholder/cancel",
  });

  /** True when the current user may fetch all stores via GET /tickets */
  const canAccessAllStores = canAccessRoute({
    service: "Maintenance",
    method: "GET",
    path: "/tickets",
  });

  // ─── Available stores ─────────────────────────────────────────────────────
  const activeStores = useMemo(
    () => overviewStores.filter((s) => s.isActive),
    [overviewStores]
  );

  // ─── Page-level store selection (independent from sidebar) ────────────────
  /**
   * `null`   → still initializing (renders skeleton / nothing)
   * string[] → one or more specific store ids the user has applied.
   *            length === 1 uses the per-store endpoint; length > 1 (or all
   *            of them) uses the global endpoint scoped via stores[] — unless
   *            the user has blanket GET /tickets access, in which case
   *            selecting every store is sent unrestricted.
   */
  const [pageStoreSelection, setPageStoreSelection] = useState<
    string[] | null
  >(null);

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // Default to whichever store is selected in the sidebar, not "All Stores" —
    // only fall back to all-stores / first-active-store when the sidebar has no
    // (valid) selection.
    const sidebarStoreId = selectedStore?.storeId;
    const sidebarStoreIsActive =
      sidebarStoreId != null &&
      activeStores.some((s) => (s.storeId ?? s.id) === sidebarStoreId);

    if (sidebarStoreIsActive) {
      setPageStoreSelection([sidebarStoreId as string]);
      setScopedStoreIds(null);
      setMode("store");
    } else if (canAccessAllStores) {
      setPageStoreSelection(activeStores.map((s) => s.storeId ?? s.id));
      setScopedStoreIds(null);
      setMode("global");
    } else {
      const first = activeStores[0];
      if (first) {
        const id = first.storeId ?? first.id;
        setPageStoreSelection([id]);
        setMode("store");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSingleStore =
    Array.isArray(pageStoreSelection) && pageStoreSelection.length === 1;

  /** storeId passed to the hook: only set for a single specific store selection. */
  const hookStoreId = isSingleStore ? pageStoreSelection![0] : undefined;

  // ─── Tickets hook ─────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isRefreshing,
    error,
    currentPage,
    filters,
    refetch,
    setMode,
    setScopedStoreIds,
    clearError,
    goToPage,
    applyFilters,
    catalogIssues,
    catalogTechnicians,
    reloadCatalog,
    analytics,
    analyticsLoading,
    analyticsError,
  } = useMaintenanceTickets({ storeId: hookStoreId });

  // ─── Dialog / sheet state ─────────────────────────────────────────────────
  const [detailTicketId, setDetailTicketId] = useState<number | null>(null);
  const [detailStoreId, setDetailStoreId] = useState<string>("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  /** Called only when the user clicks Apply in the store filter — not per checkbox click. */
  function handleStoreApply(selection: string[]) {
    if (selection.length === 0) return; // must keep at least one store selected
    setPageStoreSelection(selection);
    const isEveryStoreSelected =
      activeStores.length > 0 && selection.length === activeStores.length;
    if (selection.length === 1) {
      setScopedStoreIds(null);
      setMode("store");
    } else {
      // Unrestricted for users with blanket access when every store is picked; otherwise scope via stores[].
      setScopedStoreIds(canAccessAllStores && isEveryStoreSelected ? null : selection);
      setMode("global");
    }
  }

  function handleTicketClick(ticket: Ticket) {
    setDetailTicketId(ticket.id);
    setDetailStoreId(ticket.storeId ?? "");
    setSheetOpen(true);
  }

  function handleSheetClose() {
    setSheetOpen(false);
  }

  function handleMutationSuccess() {
    refetch();
    reloadCatalog();
  }

  // ─── Derived values ───────────────────────────────────────────────────────
  const hasSelection = pageStoreSelection !== null;
  const isStoreMode = isSingleStore;
  /** storeId forwarded to child components that need a specific store context */
  const activeStoreId = isSingleStore ? pageStoreSelection![0] : undefined;

  /**
   * Store sent as X-Store-Id on catalog/issues GET and POST.
   * Priority: page-selected store → last-opened ticket's store → first active store.
   * This ensures the header is ALWAYS populated when any store context is available.
   */
  const catalogStoreId =
    activeStoreId ||
    detailStoreId ||
    activeStores[0]?.storeId ||
    activeStores[0]?.id ||
    undefined;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isRefreshing}
        >
          <RefreshCw
            className={cn("me-2 h-4 w-4", isRefreshing && "animate-spin")}
          />
          {t("refresh")}
        </Button>
      </PageHeader>

      {/* Filters bar — always shown once a selection is initialised */}
      {hasSelection && (
        <TicketsFiltersBar
          filters={filters}
          onFiltersChange={applyFilters}
          onCreateClick={() => setCreateOpen(true)}
          onCatalogClick={() => setCatalogOpen(true)}
          canAccessCatalog={canAccessCatalog}
          storeId={catalogStoreId}
          disabled={isLoading}
          stores={activeStores}
          selectedStoreIds={pageStoreSelection ?? []}
          onStoreApply={handleStoreApply}
        />
      )}

      {/* Analytics — reflects whatever filters/store are currently applied */}
      {hasSelection && (
        <TicketsAnalyticsPanel
          analytics={analytics}
          isLoading={analyticsLoading}
          error={analyticsError}
        />
      )}

      {/* Still initialising */}
      {!hasSelection && <TicketsSkeleton />}

      {/* Loading skeleton */}
      {hasSelection && isLoading && !data && <TicketsSkeleton />}

      {/* Error state */}
      {hasSelection && error && !data && (
        <TicketsErrorCard
          error={error}
          onRetry={() => refetch()}
          onClearError={clearError}
        />
      )}

      {/* Empty data */}
      {hasSelection && !isLoading && !error && data && data.data.length === 0 && (
        <TicketsEmptyState type="no-data" />
      )}

      {/* Data table */}
      {hasSelection && data && data.data.length > 0 && (
        <TicketsTable
          data={data}
          isRefreshing={isRefreshing}
          currentPage={currentPage}
          onPageChange={goToPage}
          onTicketClick={handleTicketClick}
          onRowChanged={handleMutationSuccess}
          canCancelTicket={canCancelTicket}
        />
      )}

      {/* Create ticket dialog */}
      <CreateTicketDialog
        open={createOpen}
        storeId={activeStoreId ?? ""}
        catalogIssues={catalogIssues}
        stores={!isStoreMode ? activeStores : undefined}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleMutationSuccess}
      />

      {/* Ticket detail sheet */}
      <TicketDetailSheet
        open={sheetOpen}
        ticketId={detailTicketId}
        storeId={detailStoreId || activeStoreId || ""}
        technicians={catalogTechnicians}
        tickets={data?.data ?? []}
        filters={filters}
        onFiltersChange={applyFilters}
        onClose={handleSheetClose}
        currentPage={currentPage}
        totalPages={data?.meta.lastPage}
        isPageLoading={isLoading || isRefreshing}
        onNextPage={() => goToPage(currentPage + 1)}
        onPreviousPage={() => goToPage(currentPage - 1)}
      />

      {/* Catalog management dialog */}
      <CatalogManagementDialog
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onReloadCatalog={reloadCatalog}
        storeId={catalogStoreId}
      />
    </div>
  );
}
