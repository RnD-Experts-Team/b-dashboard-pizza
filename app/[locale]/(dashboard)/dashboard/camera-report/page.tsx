"use client";

import { useTranslations } from "next-intl";
import { useCameraReport } from "@/lib/hooks/use-camera-report";
import { PageHeader } from "@/components/layout/page-header";
import { CameraReportTable } from "@/components/qa/camera-report-table";
import { CameraReportError } from "@/components/qa/camera-report-error";
import { CameraReportSkeleton } from "@/components/qa/camera-report-skeleton";
import { CameraReportFilters } from "@/components/qa/camera-report-filters";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CameraReportPage() {
  const t = useTranslations("cameraReport");
  const {
    data,
    isLoading,
    isRefreshing,
    error,
    filters,
    isExporting,
    isExportingExcel,
    isExportingImages,
    refetch,
    applyFilters,
    exportReport,
    exportReportExcel,
    exportReportImages,
    clearError,
  } = useCameraReport();

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
            className={cn(
              "me-2 h-4 w-4",
              isRefreshing && "animate-spin"
            )}
          />
          {t("refresh")}
        </Button>
      </PageHeader>

      {/* Filters & Export */}
      <CameraReportFilters
        data={data}
        filters={filters}
        isLoading={isLoading}
        isExporting={isExporting}
        isExportingExcel={isExportingExcel}
        isExportingImages={isExportingImages}
        onApplyFilters={applyFilters}
        onExport={exportReport}
        onExportExcel={exportReportExcel}
        onExportImages={exportReportImages}
      />

      {isLoading && !data && <CameraReportSkeleton />}

      {error && !data && (
        <CameraReportError
          error={error}
          onRetry={refetch}
          onClearError={clearError}
        />
      )}

      {data && (
        <CameraReportTable data={data} isRefreshing={isRefreshing} />
      )}
    </div>
  );
}
