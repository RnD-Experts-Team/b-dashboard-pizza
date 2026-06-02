"use client";

import { useState } from "react";
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

export default function MaintenanceTicketsPage() {
  const t = useTranslations("maintenanceTickets");

  const {
    data,
    isLoading,
    isRefreshing,
    error,
    currentPage,
    filters,
    refetch,
    clearError,
    goToPage,
    applyFilters,
    selectedStore,
    catalogIssues,
    catalogTechnicians,
    reloadCatalog,
  } = useMaintenanceTickets();

  const [detailTicketId, setDetailTicketId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  function handleTicketClick(id: number) {
    setDetailTicketId(id);
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

      {/* Filters bar — shown when store is selected */}
      {selectedStore && (
        <TicketsFiltersBar
          filters={filters}
          onFiltersChange={applyFilters}
          onCreateClick={() => setCreateOpen(true)}
          onCatalogClick={() => setCatalogOpen(true)}
          disabled={isLoading}
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
        storeId={selectedStore?.storeId ?? ""}
        technicians={catalogTechnicians}
        onClose={handleSheetClose}
      />

      {/* Catalog management dialog */}
      <CatalogManagementDialog
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onReloadCatalog={reloadCatalog}
      />
    </div>
  );
}
