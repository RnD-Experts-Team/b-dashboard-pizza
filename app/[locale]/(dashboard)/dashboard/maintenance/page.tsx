"use client";

import { useTranslations } from "next-intl";
import { useMaintenance } from "@/lib/hooks/use-maintenance";
import { PageHeader } from "@/components/layout/page-header";
import { MaintenanceRequestsTable } from "@/components/maintenance/maintenance-requests-table";
import { MaintenanceEmptyState } from "@/components/maintenance/maintenance-empty-state";
import { MaintenanceErrorCard } from "@/components/maintenance/maintenance-error";
import { MaintenanceSkeleton } from "@/components/maintenance/maintenance-skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MaintenancePage() {
  const t = useTranslations("maintenance");
  const {
    data,
    isLoading,
    isRefreshing,
    error,
    currentPage,
    refetch,
    clearError,
    goToPage,
    selectedStore,
  } = useMaintenance();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefreshing}
          >
            <RefreshCw
              className={cn(
                "me-2 h-4 w-4",
                isRefreshing && "animate-spin"
              )}
            />
            {t("refresh")}
          </Button>
        </div>
      </PageHeader>

      {/* No store selected */}
      {!selectedStore && (
        <MaintenanceEmptyState type="no-store" />
      )}

      {/* Loading skeleton */}
      {selectedStore && isLoading && !data && <MaintenanceSkeleton />}

      {/* Error state */}
      {selectedStore && error && !data && (
        <MaintenanceErrorCard
          error={error}
          onRetry={() => refetch()}
          onClearError={clearError}
        />
      )}

      {/* Empty data */}
      {selectedStore && !isLoading && !error && data && data.data.length === 0 && (
        <MaintenanceEmptyState type="no-data" />
      )}

      {/* Data table */}
      {selectedStore && data && data.data.length > 0 && (
        <MaintenanceRequestsTable
          data={data}
          isRefreshing={isRefreshing}
          currentPage={currentPage}
          onPageChange={goToPage}
          requirements={[
            {
              service: "Maintenance",
              method: "GET",
              path: "/maintenance-requests/{id}",
              storeId: selectedStore.id ? String(selectedStore.id) : undefined,
            },
          ]}
        />
      )}
    </div>
  );
}
