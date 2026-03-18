"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type {
  CameraReportData,
  CameraReportSummaryItem,
  CameraReportEntityDef,
  CameraReportCategory,
  CameraReportRatingCount,
} from "@/types/qa.types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Camera, Store } from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface CameraReportTableProps {
  data: CameraReportData;
  isRefreshing: boolean;
}

/** Category group with its entities, used for building the pivot header */
interface CategoryColumn {
  category: CameraReportCategory;
  entities: CameraReportEntityDef[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function getRatingVariant(
  label: string
): "default" | "destructive" | "secondary" | "outline" {
  const lower = label.toLowerCase();
  if (lower === "pass") return "default";
  if (lower === "fail") return "destructive";
  if (lower === "auto fail") return "secondary";
  return "outline";
}

function formatScore(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

/**
 * Build ordered category → entity columns from entity definitions.
 * Sorted by category sort_order, then entity sort_order.
 */
function buildCategoryColumns(
  entities: CameraReportEntityDef[]
): CategoryColumn[] {
  const categoryMap = new Map<number, CategoryColumn>();

  for (const entity of entities) {
    const catId = entity.category.id;
    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        category: entity.category,
        entities: [],
      });
    }
    categoryMap.get(catId)!.entities.push(entity);
  }

  // Sort categories by sort order, then entities within each category
  const columns = Array.from(categoryMap.values());
  columns.sort((a, b) => a.category.sortOrder - b.category.sortOrder);
  for (const col of columns) {
    col.entities.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return columns;
}

/**
 * Get the rating counts for a specific entity in a store's summary,
 * or undefined if not found.
 */
function getEntityRatings(
  store: CameraReportSummaryItem,
  entityId: number
): CameraReportRatingCount[] | undefined {
  const entity = store.entities[String(entityId)];
  return entity?.ratingCounts;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Rating cell content                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function RatingCell({
  ratingCounts,
}: {
  ratingCounts: CameraReportRatingCount[] | undefined;
}) {
  if (!ratingCounts || ratingCounts.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {ratingCounts.map((rc) => (
        <Badge
          key={rc.ratingLabel}
          variant={getRatingVariant(rc.ratingLabel)}
          className="text-xs whitespace-nowrap"
        >
          {rc.ratingLabel}: {rc.count}
        </Badge>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Component                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export function CameraReportTable({
  data,
  isRefreshing,
}: CameraReportTableProps) {
  const t = useTranslations("cameraReport");

  // Build pivot structure
  const categoryColumns = useMemo(
    () => buildCategoryColumns(data.entities),
    [data.entities]
  );

  // Total entity columns (for colSpan calculations)
  const totalEntityCols = useMemo(
    () => categoryColumns.reduce((sum, c) => sum + c.entities.length, 0),
    [categoryColumns]
  );

  // Stores from summary, de-duplicated and sorted
  const stores = useMemo(() => {
    return data.summary.slice().sort((a, b) => {
      // Sort by store name
      return a.storeName.localeCompare(b.storeName);
    });
  }, [data.summary]);

  const hasData = stores.length > 0 && totalEntityCols > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {t("tableTitle")}
            </CardTitle>
            <CardDescription>
              {t("totalStores", { count: data.totalStores })}
              {data.filters.dateFrom && data.filters.dateTo && (
                <span className="ms-2 text-xs">
                  ({data.filters.dateFrom} → {data.filters.dateTo})
                </span>
              )}
            </CardDescription>
          </div>
          {isRefreshing && (
            <span className="text-xs text-muted-foreground animate-pulse">
              {t("refreshing")}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Camera className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">{t("noData")}</p>
          </div>
        ) : (
          <>
            {/* ─── Desktop pivot table ─── */}
            <div className="hidden lg:block overflow-x-auto pb-2">
              <Table className="min-w-240">
                <TableHeader>
                  {/* Row 1: Category headers */}
                  <TableRow className="bg-muted/30">
                    <TableHead
                      rowSpan={2}
                      className="align-middle border-e min-w-45 sticky start-0 bg-muted z-10 py-3 px-8"
                    >
                      {t("columns.store")}
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className="align-middle border-e text-center w-30 py-3 bg-muted"
                    >
                      <div className="flex flex-col items-center leading-tight">
                        <span>{t("scoreLabel")}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {t("scoreWithAutoFailSub")}
                        </span>
                      </div>
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className="align-middle border-e text-center w-30 py-3 bg-muted"
                    >
                      <div className="flex flex-col items-center leading-tight">
                        <span>{t("scoreLabel")}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {t("scoreWithoutAutoFailSub")}
                        </span>
                      </div>
                    </TableHead>
                    {categoryColumns.map((col) => (
                      <TableHead
                        key={col.category.id}
                        colSpan={col.entities.length}
                        className="align-middle text-center border-e last:border-e-0 bg-muted py-3"
                      >
                        <Badge variant="secondary" className="text-xs">
                          {col.category.label}
                        </Badge>
                      </TableHead>
                    ))}
                  </TableRow>

                  {/* Row 2: Entity headers (under each category) */}
                  <TableRow className="bg-muted/20">
                    {categoryColumns.flatMap((col) =>
                      col.entities.map((entity, idx) => (
                        <TableHead
                          key={entity.id}
                          className={cn(
                            "align-middle text-center text-xs min-w-30 py-2",
                            idx === col.entities.length - 1 &&
                              "border-e last:border-e-0"
                          )}
                        >
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block max-w-30 cursor-default">
                                  {entity.entityLabel}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  {entity.entityLabel}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                      ))
                    )}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {stores.map((store) => {
                    const score =
                      data.scoreData[String(store.storeId)];

                    return (
                      <TableRow
                        key={store.storeId}
                        className={cn(
                          "transition-colors hover:bg-muted/10",
                          isRefreshing && "opacity-60"
                        )}
                      >
                        {/* Store name + group */}
                        <TableCell className="border-e sticky start-0 bg-muted z-10">
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex flex-col">
                              <span
                                className="font-medium text-sm truncate max-w-40"
                                title={store.storeName}
                              >
                                {store.storeName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {t("columns.group")}: {store.storeGroup}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Score with auto fail */}
                        <TableCell className="border-e text-center bg-muted">
                          {score ? (
                            <span className="font-mono text-sm">
                              {formatScore(score.scoreWithAutoFail)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Score without auto fail */}
                        <TableCell className="border-e text-center bg-muted">
                          {score ? (
                            <span className="font-mono text-sm">
                              {formatScore(score.scoreWithoutAutoFail)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Rating cells for each entity */}
                        {categoryColumns.flatMap((col) =>
                          col.entities.map((entity, idx) => (
                            <TableCell
                              key={`${store.storeId}-${entity.id}`}
                              className={cn(
                                "text-center",
                                idx === col.entities.length - 1 &&
                                  "border-e last:border-e-0"
                              )}
                            >
                              <RatingCell
                                ratingCounts={getEntityRatings(
                                  store,
                                  entity.id
                                )}
                              />
                            </TableCell>
                          ))
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* ─── Mobile cards ─── */}
            <div className="space-y-4 lg:hidden">
              {stores.map((store) => {
                const score =
                  data.scoreData[String(store.storeId)];

                return (
                  <div
                    key={`mobile-${store.storeId}`}
                    className={cn(
                      "rounded-lg border",
                      isRefreshing && "opacity-60"
                    )}
                  >
                    {/* Store header */}
                    <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {store.storeName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t("columns.group")}: {store.storeGroup}
                          </span>
                        </div>
                      </div>
                      {score && (
                        <div className="text-end">
                          <div className="font-mono text-sm text-muted-foreground">
                            {formatScore(score.scoreWithAutoFail)}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {formatScore(score.scoreWithoutAutoFail)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Categories & entities */}
                    <div className="p-4 space-y-3">
                      {categoryColumns.map((col) => (
                        <div key={col.category.id} className="space-y-2">
                          <Badge variant="secondary" className="text-xs">
                            {col.category.label}
                          </Badge>
                          <div className="space-y-1.5 ps-2">
                            {col.entities.map((entity) => {
                              const ratings = getEntityRatings(
                                store,
                                entity.id
                              );
                              return (
                                <div
                                  key={entity.id}
                                  className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <span className="text-xs text-muted-foreground">
                                    {entity.entityLabel}
                                  </span>
                                  <RatingCell ratingCounts={ratings} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
