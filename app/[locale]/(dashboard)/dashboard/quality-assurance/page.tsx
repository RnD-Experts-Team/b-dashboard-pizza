"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useCameraFormsList } from "@/lib/hooks/use-camera-forms-list";
import { PageHeader } from "@/components/layout/page-header";
import { CameraFormsListTable } from "@/components/qa/camera-forms-list-table";
import { CameraFormsListFilters } from "@/components/qa/camera-forms-list-filters";
import { CameraFormsListSkeleton } from "@/components/qa/camera-forms-list-skeleton";
import { CameraFormsListError } from "@/components/qa/camera-forms-list-error";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, CalendarDays, CalendarRange, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";

export default function QualityAssurancePage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { canAccessRoute, overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();

  // Mirror sidebar behavior: selected store first, then first overview store.
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;
  const createFormRequirements = [
    {
      service: "QA",
      method: "POST",
      path: "/camera-forms",
      storeId: effectiveStoreId,
    },
  ];
  const canCreateCameraForm = createFormRequirements.some((requirement) =>
    canAccessRoute(requirement)
  );
  
  const {
    // Daily
    dailyData,
    dailyPage,
    dailyLoading,
    dailyRefreshing,
    dailyError,
    setDailyPage,
    refetchDaily,
    clearDailyError,

    // Weekly
    weeklyData,
    weeklyPage,
    weeklyLoading,
    weeklyRefreshing,
    weeklyError,
    setWeeklyPage,
    refetchWeekly,
    clearWeeklyError,

    // Shared
    filters,
    setFilters,
    applyFilters,
    resetFilters,
    refetchAll,

    // Delete
    isDeleting,
    deleteCameraForm,
  } = useCameraFormsList();

  const isAnyLoading = dailyLoading || weeklyLoading;
  const isAnyRefreshing = dailyRefreshing || weeklyRefreshing;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Camera Forms"
        description="View and manage camera form audits across all stores."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refetchAll}
            disabled={isAnyLoading || isAnyRefreshing}
          >
            <RefreshCw
              className={cn(
                "me-2 h-4 w-4",
                isAnyRefreshing && "animate-spin"
              )}
            />
            {isAnyRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          {canCreateCameraForm && (
            <Button asChild size="sm">
              <Link href={`/${locale}/dashboard/quality-assurance/create-camera-forms`}>
                <Plus className="me-2 h-4 w-4" />
                Create Form
              </Link>
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Filters */}
      <CameraFormsListFilters
        filters={filters}
        isLoading={isAnyLoading || isAnyRefreshing}
        onSetFilters={setFilters}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      {/* Tabs: Daily & Weekly */}
      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
          <TabsTrigger value="daily" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            <span>Daily</span>
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-2">
            <CalendarRange className="h-4 w-4" />
            <span>Weekly</span>
          </TabsTrigger>
        </TabsList>

        {/* ──── Daily Tab ──── */}
        <TabsContent value="daily">
          {dailyLoading && !dailyData && <CameraFormsListSkeleton />}

          {dailyError && !dailyData && (
            <CameraFormsListError
              error={dailyError}
              onRetry={refetchDaily}
              onDismiss={clearDailyError}
            />
          )}

          {dailyData && (
            <CameraFormsListTable
              data={dailyData}
              isRefreshing={dailyRefreshing}
              currentPage={dailyPage}
              onPageChange={setDailyPage}
              label="Daily Camera Forms"
              onDelete={deleteCameraForm}
              isDeleting={isDeleting}
            />
          )}

          {!dailyLoading && !dailyError && !dailyData && (
            <CameraFormsListSkeleton />
          )}
        </TabsContent>

        {/* ──── Weekly Tab ──── */}
        <TabsContent value="weekly">
          {weeklyLoading && !weeklyData && <CameraFormsListSkeleton />}

          {weeklyError && !weeklyData && (
            <CameraFormsListError
              error={weeklyError}
              onRetry={refetchWeekly}
              onDismiss={clearWeeklyError}
            />
          )}

          {weeklyData && (
            <CameraFormsListTable
              data={weeklyData}
              isRefreshing={weeklyRefreshing}
              currentPage={weeklyPage}
              onPageChange={setWeeklyPage}
              label="Weekly Camera Forms"
              onDelete={deleteCameraForm}
              isDeleting={isDeleting}
            />
          )}

          {!weeklyLoading && !weeklyError && !weeklyData && (
            <CameraFormsListSkeleton />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
