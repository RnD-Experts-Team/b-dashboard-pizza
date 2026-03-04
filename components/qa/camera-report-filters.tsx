"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import type {
  CameraReportData,
  CameraReportStore,
} from "@/types/qa.types";
import type { CameraReportFilterParams } from "@/lib/store/camera-report.store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Filter,
  X,
  Loader2,
  FileSpreadsheet,
  Image as ImageIcon,
  FileArchive,
} from "lucide-react";

interface CameraReportFiltersProps {
  data: CameraReportData | null;
  filters: CameraReportFilterParams;
  isLoading: boolean;
  isExporting: boolean;
  isExportingExcel?: boolean;
  isExportingImages?: boolean;
  onApplyFilters: (filters: CameraReportFilterParams) => void;
  onExport: () => void;
  onExportExcel?: () => void;
  onExportImages?: () => void;
}

export function CameraReportFilters({
  data,
  filters,
  isLoading,
  isExporting,
  isExportingExcel = false,
  isExportingImages = false,
  onApplyFilters,
  onExport,
  onExportExcel,
  onExportImages,
}: CameraReportFiltersProps) {
  const t = useTranslations("cameraReport");

  // Local filter state (only applied when user clicks "Apply")
  const [localFilters, setLocalFilters] =
    useState<CameraReportFilterParams>(filters);

  // Available options from data
  const stores: CameraReportStore[] = data?.stores ?? [];
  const groups: number[] = data?.groups ?? [];

  // Hardcoded rating options
  const ratingOptions = [
    { id: 1, label: t("filters.ratingPass") },
    { id: 2, label: t("filters.ratingFail") },
    { id: 3, label: t("filters.ratingNotDone") },
    { id: 4, label: t("filters.ratingCameraFail") },
    { id: 5, label: t("filters.ratingAutoFail") },
    { id: 6, label: t("filters.ratingUrgent") },
  ];

  const handleApply = useCallback(() => {
    onApplyFilters(localFilters);
  }, [localFilters, onApplyFilters]);

  const handleReset = useCallback(() => {
    const empty: CameraReportFilterParams = {};
    setLocalFilters(empty);
    onApplyFilters(empty);
  }, [onApplyFilters]);

  const hasActiveFilters =
    Object.values(filters).some(
      (v) => v !== undefined && v !== "" && v !== null
    );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            {t("filters.title")}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isLoading}
              >
                <X className="me-1 h-3.5 w-3.5" />
                {t("filters.reset")}
              </Button>
            )}

            {/* Download ZIP */}
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={isExporting || isLoading || isExportingExcel || isExportingImages}
            >
              {isExporting ? (
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileArchive className="me-1.5 h-3.5 w-3.5" />
              )}
              {t("filters.export")}
            </Button>

            {/* Export Excel */}
            {onExportExcel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportExcel}
                disabled={isExportingExcel || isLoading || isExporting || isExportingImages}
              >
                {isExportingExcel ? (
                  <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="me-1.5 h-3.5 w-3.5" />
                )}
                {t("filters.exportExcel")}
              </Button>
            )}

            {/* Export Images */}
            {onExportImages && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportImages}
                disabled={isExportingImages || isLoading || isExporting || isExportingExcel}
              >
                {isExportingImages ? (
                  <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="me-1.5 h-3.5 w-3.5" />
                )}
                {t("filters.exportImages")}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Store */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("filters.store")}</Label>
            <Select
              value={
                localFilters.store_id
                  ? String(localFilters.store_id)
                  : "all"
              }
              onValueChange={(val) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  store_id: val === "all" ? undefined : Number(val),
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("filters.allStores")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("filters.allStores")}
                </SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.store}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Group */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("filters.group")}</Label>
            <Select
              value={
                localFilters.group ? String(localFilters.group) : "all"
              }
              onValueChange={(val) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  group: val === "all" ? undefined : Number(val),
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("filters.allGroups")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("filters.allGroups")}
                </SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    {t("filters.groupLabel", { group: g })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Report Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("filters.reportType")}</Label>
            <Select
              value={localFilters.report_type || "all"}
              onValueChange={(val) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  report_type: val === "all" ? undefined : val,
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("filters.allTypes")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("filters.allTypes")}
                </SelectItem>
                <SelectItem value="main">
                  {t("filters.main")}
                </SelectItem>
                <SelectItem value="secondary">
                  {t("filters.secondary")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("filters.dateFrom")}</Label>
            <Input
              type="date"
              value={localFilters.date_from ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  date_from: e.target.value || undefined,
                }))
              }
            />
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("filters.dateTo")}</Label>
            <Input
              type="date"
              value={localFilters.date_to ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  date_to: e.target.value || undefined,
                }))
              }
            />
          </div>

          {/* Rating */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("filters.rating")}</Label>
            <Select
              value={
                localFilters.rating_id
                  ? String(localFilters.rating_id)
                  : "all"
              }
              onValueChange={(val) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  rating_id: val === "all" ? undefined : Number(val),
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("filters.allRatings")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("filters.allRatings")}
                </SelectItem>
                {ratingOptions.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Apply button */}
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={handleApply} disabled={isLoading}>
            <Filter className="me-1.5 h-3.5 w-3.5" />
            {t("filters.apply")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
