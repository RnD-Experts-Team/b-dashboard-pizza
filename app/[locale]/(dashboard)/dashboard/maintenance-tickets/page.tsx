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
  CreateTicketDialog,
  TicketDetailSheet,
  CatalogManagementDialog,
} from "@/components/maintenance-tickets";
import { useMaintenanceTickets } from "@/lib/hooks/use-maintenance-tickets";
import { useAuth } from "@/lib/auth/use-auth";
import { useAuthStore } from "@/lib/auth/auth.store";
import type { Ticket } from "@/types/maintenance-tickets.types";

export default function MaintenanceTicketsPage() {
  const t = useTranslations("maintenanceTickets");
  const { canAccessRoute } = useAuth();
  const { overviewStores } = useAuthStore();

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
   * `null`  → still initializing (renders skeleton / nothing)
   * `"all"` → global mode, fetches all stores
   * string  → specific store's human-readable storeId (e.g. "03795-00001")
   */
  const [pageSelectedStoreId, setPageSelectedStoreId] = useState<
    string | "all" | null
  >(null);

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (canAccessAllStores) {
      setPageSelectedStoreId("all");
      setMode("global");
    } else {
      const first = activeStores[0];
      if (first) {
        const id = first.storeId ?? first.id;
        setPageSelectedStoreId(id);
        setMode("store");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** storeId passed to the hook: undefined when "all" so mode drives fetch. */
  const hookStoreId =
    pageSelectedStoreId && pageSelectedStoreId !== "all"
      ? pageSelectedStoreId
      : undefined;

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
    clearError,
    goToPage,
    applyFilters,
    catalogIssues,
    catalogTechnicians,
    reloadCatalog,
  } = useMaintenanceTickets({ storeId: hookStoreId });

  // ─── Dialog / sheet state ─────────────────────────────────────────────────
  const [detailTicketId, setDetailTicketId] = useState<number | null>(null);
  const [detailStoreId, setDetailStoreId] = useState<string>("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  function handleStoreChange(storeId: string | "all") {
    setPageSelectedStoreId(storeId);
    if (storeId === "all") {
      setMode("global");
    } else {
      setMode("store");
    }
  }

  function handleTicketClick(ticket: Ticket) {
    setDetailTicketId(ticket.id);
    setDetailStoreId(ticket.storeId);
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
  const hasSelection = pageSelectedStoreId !== null;
  const isStoreMode =
    pageSelectedStoreId !== null && pageSelectedStoreId !== "all";
  /** storeId forwarded to child components that need a specific store context */
  const activeStoreId = isStoreMode ? pageSelectedStoreId : undefined;

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
          storeId={activeStoreId}
          disabled={isLoading}
          stores={activeStores}
          selectedStoreId={pageSelectedStoreId ?? undefined}
          onStoreChange={handleStoreChange}
          canAccessAllStores={canAccessAllStores}
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

      {/* Create ticket dialog — only meaningful for a specific store */}
      {isStoreMode && (
        <CreateTicketDialog
          open={createOpen}
          storeId={activeStoreId ?? ""}
          catalogIssues={catalogIssues}
          onClose={() => setCreateOpen(false)}
          onSuccess={handleMutationSuccess}
        />
      )}

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
      />

      {/* Catalog management dialog */}
      <CatalogManagementDialog
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onReloadCatalog={reloadCatalog}
        storeId={activeStoreId}
      />
    </div>
  );
}
