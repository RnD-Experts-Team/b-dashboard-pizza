"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import type {
  CameraReportData,
  CameraReportStore,
} from "@/types/qa.types";
import type { CameraReportFilterParams } from "@/lib/store/camera-report.store";
import { useQAEntityCategories } from "@/lib/hooks/use-qa-entities";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  ChevronsUpDown,
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
  const { categories, isLoading: isCategoriesLoading } =
    useQAEntityCategories();

  // Local filter state (only applied when user clicks "Apply")
  const [localFilters, setLocalFilters] =
    useState<CameraReportFilterParams>(filters);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)
      ),
    [categories]
  );

  const selectedCategoryIds = localFilters.category_ids ?? [];

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
      (v) =>
        Array.isArray(v)
          ? v.length > 0
          : v !== undefined && v !== "" && v !== null
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
              disabled={
                isExporting ||
                isLoading ||
                isExportingExcel ||
                isExportingImages
              }
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
                disabled={
                  isExportingExcel ||
                  isLoading ||
                  isExporting ||
                  isExportingImages
                }
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
                disabled={
                  isExportingImages ||
                  isLoading ||
                  isExporting ||
                  isExportingExcel
                }
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-8">
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
              <SelectContent
                position="popper"
                style={{ maxHeight: "200px", overflowY: "auto" }}
              >
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

          {/* Categories (multi-select) */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("filters.category")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedCategoryIds.length === 0
                      ? t("filters.allCategories")
                      : t("filters.selectedCategories", {
                          count: selectedCategoryIds.length,
                        })}
                  </span>
                  <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start">
                <div className="max-h-56 overflow-y-auto">
                  <div className="space-y-1">
                    {isCategoriesLoading && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {t("filters.loadingCategories")}
                      </div>
                    )}

                    {!isCategoriesLoading && sortedCategories.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {t("filters.noCategories")}
                      </div>
                    )}

                    {!isCategoriesLoading &&
                      sortedCategories.map((category) => {
                        const checked = selectedCategoryIds.includes(category.id);
                        return (
                          <label
                            key={category.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(state) => {
                                const isChecked = state === true;
                                setLocalFilters((prev) => {
                                  const current = prev.category_ids ?? [];
                                  const next = isChecked
                                    ? current.includes(category.id)
                                      ? current
                                      : [...current, category.id]
                                    : current.filter((id) => id !== category.id);

                                  return {
                                    ...prev,
                                    category_ids:
                                      next.length > 0 ? next : undefined,
                                  };
                                });
                              }}
                            />
                            <span className="flex-1 text-sm">{category.label}</span>
                            <span className="text-xs text-muted-foreground">
                              #{category.id}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                {selectedCategoryIds.length > 0 && (
                  <div className="mt-2 border-t pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-full text-xs text-muted-foreground"
                      onClick={() =>
                        setLocalFilters((prev) => ({
                          ...prev,
                          category_ids: undefined,
                        }))
                      }
                    >
                      {t("filters.clearCategories")}
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
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

          {/* Date Range Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("filters.dateRangeType")}</Label>
            <Select
              value={localFilters.date_range_type || "all"}
              onValueChange={(val) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  date_range_type:
                    val === "all" ? undefined : (val as "daily" | "weekly"),
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("filters.allDateRanges")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("filters.allDateRanges")}
                </SelectItem>
                <SelectItem value="daily">
                  {t("filters.daily")}
                </SelectItem>
                <SelectItem value="weekly">
                  {t("filters.weekly")}
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

          {/* Custom Report ID */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("filters.customReportId")}</Label>
            <Select
              value={
                localFilters.custom_report_id
                  ? String(localFilters.custom_report_id)
                  : "all"
              }
              onValueChange={(val) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  custom_report_id: val === "all" ? undefined : Number(val),
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("filters.allCustomReports")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("filters.allCustomReports")}
                </SelectItem>
                {(data?.customReports ?? []).map((cr) => (
                  <SelectItem key={cr.id} value={String(cr.id)}>
                    {cr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Apply button */}
          <div className="flex items-end">
            <Button size="sm" onClick={handleApply} disabled={isLoading} className="w-full">
              <Filter className="me-1.5 h-3.5 w-3.5" />
              {t("filters.apply")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
