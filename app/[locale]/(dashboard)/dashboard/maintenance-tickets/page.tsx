"use client";

import { useEffect, useState } from "react";
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
import type { Ticket } from "@/types/maintenance-tickets.types";

export default function MaintenanceTicketsPage() {
  const t = useTranslations("maintenanceTickets");
  const { canAccessRoute } = useAuth();

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
    selectedStore,
    catalogIssues,
    catalogTechnicians,
    reloadCatalog,
  } = useMaintenanceTickets();

  const [detailTicketId, setDetailTicketId] = useState<number | null>(null);
  const [detailStoreId, setDetailStoreId] = useState<string>("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => {
    setMode("store");
  }, [setMode]);

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

      {/* Filters bar */}
      {selectedStore && (
        <TicketsFiltersBar
          filters={filters}
          onFiltersChange={applyFilters}
          onCreateClick={() => setCreateOpen(true)}
          onCatalogClick={() => setCatalogOpen(true)}
          canAccessCatalog={canAccessCatalog}
          storeId={selectedStore?.storeId}
          disabled={isLoading || !selectedStore}
        />
      )}

      {/* No store selected */}
      {!selectedStore && <TicketsEmptyState type="no-store" />}

      {/* Loading skeleton */}
      {selectedStore && isLoading && !data && <TicketsSkeleton />}

      {/* Error state */}
      {selectedStore && error && !data && (
        <TicketsErrorCard
          error={error}
          onRetry={() => refetch()}
          onClearError={clearError}
        />
      )}

      {/* Empty data */}
      {selectedStore && !isLoading && !error && data && data.data.length === 0 && (
        <TicketsEmptyState type="no-data" />
      )}

      {/* Data table */}
      {selectedStore && data && data.data.length > 0 && (
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
        storeId={selectedStore?.storeId ?? ""}
        catalogIssues={catalogIssues}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleMutationSuccess}
      />

      {/* Ticket detail sheet */}
      <TicketDetailSheet
        open={sheetOpen}
        ticketId={detailTicketId}
        storeId={detailStoreId || selectedStore?.storeId || ""}
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
        storeId={selectedStore?.storeId}
      />
    </div>
  );
}
