"use client";

import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Grid3x3, HardHat, Siren, Store as StoreIcon, Table2, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { MultiSelect } from "@/components/shared/multi-select";
import { cn } from "@/lib/utils";
import { useMaintenanceCoverage } from "@/lib/hooks/use-maintenance-analytics";
import type { CoverageCell, CoverageParams } from "@/types/maintenance-system";
import { AnalyticsCard } from "@/components/maintenance-tickets/analytics/analytics-card";
import { KpiTile } from "@/components/maintenance-tickets/analytics/analytics-kpis";
import { useCatalogIssues } from "@/components/maintenance-technicians/use-catalog-issues";
import { DataTable } from "./chart-kit";
import type { AnalyticsFilters } from "./use-analytics-filters";

const KPI_SKELETONS = 4;
/** Technicians and emergency: the count columns of the list view. */
const COUNT_COLUMNS = [2, 3];
const ISSUE_SEPARATOR = ",";
const PEOPLE_TINT = "bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400";

/**
 * Cell shading by how many technicians cover it. A gap (0 or 1) is rose or
 * amber AND carries the ⚠ icon and the word "Gap" — never colour alone.
 * Index = technicians; the last entry is for that many or more.
 */
const SHADES = [
  "bg-rose-500/15 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-violet-500/10 text-foreground dark:bg-violet-500/15",
  "bg-violet-500/25 text-foreground dark:bg-violet-500/30",
  "bg-violet-500/40 text-foreground dark:bg-violet-500/45",
];
const shadeOf = (count: number) => SHADES[Math.min(count, SHADES.length - 1)];

/**
 * Coverage (docs/MAINTENANCE-UI.md §8): who we could call, per store and
 * issue. KPI tiles, then the store × issue grid — each cell the number of
 * technicians covering both, shaded by count, ⚠ "Gap" when there are 0–1;
 * the tooltip adds how many come out for emergencies and their ★ average.
 * Issue filter and "Gaps only" are in the URL (`issues=`, `gaps=1`).
 */
export function CoverageTab({ filters }: { filters: AnalyticsFilters }) {
  const t = useTranslations("maintenanceSystem");
  const { issues: catalog } = useCatalogIssues();
  const issuesParam = filters.get("issues");
  const issueIds = useMemo(
    () => (issuesParam ? issuesParam.split(ISSUE_SEPARATOR).map(Number).filter(Boolean) : []),
    [issuesParam],
  );
  const gapsOnly = filters.get("gaps") === "1";
  const [asList, setAsList] = useState(false);

  const params: CoverageParams = useMemo(
    () => ({
      stores: filters.stores.length ? filters.stores : undefined,
      issueIds: issueIds.length ? issueIds : undefined,
      categoryId: filters.categoryId ?? undefined,
    }),
    [filters.stores, filters.categoryId, issueIds],
  );
  const { coverage, isLoading, isRefreshing, error, refresh } = useMaintenanceCoverage(params);

  const grid = useMemo(() => {
    const cells = coverage?.cells ?? [];
    const storeSet = new Set<string>();
    const issueMap = new Map<number, string>();
    const byKey = new Map<string, CoverageCell>();
    cells.forEach((c) => {
      storeSet.add(c.storeNumber);
      issueMap.set(c.issueId, c.title);
      byKey.set(`${c.storeNumber}:${c.issueId}`, c);
    });
    const gapStores = new Set(cells.filter((c) => c.gap).map((c) => c.storeNumber));
    const gapIssues = new Set(cells.filter((c) => c.gap).map((c) => c.issueId));
    const stores = [...storeSet].filter((s) => !gapsOnly || gapStores.has(s));
    const issues = [...issueMap.entries()].filter(([id]) => !gapsOnly || gapIssues.has(id)).map(([id, title]) => ({ id, title }));
    const listed = cells.filter((c) => !gapsOnly || c.gap);
    return { stores, issues, byKey, listed };
  }, [coverage, gapsOnly]);

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label={t("analytics.loading")}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: KPI_SKELETONS }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error || !coverage) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
        <p className="max-w-sm text-sm text-muted-foreground">{error?.message ?? t("common.loadError")}</p>
        <Button variant="outline" onClick={() => void refresh()}>{t("common.retry")}</Button>
      </div>
    );
  }

  const k = coverage.kpis;
  const cellTitle = (c: CoverageCell) =>
    [
      `${c.storeNumber} · ${c.title}`,
      t("analytics.cellTechnicians", { count: c.technicians }),
      t("analytics.cellEmergency", { count: c.emergency }),
      c.averageRating ? t("analytics.cellRating", { rating: c.averageRating }) : t("technicians.notRated"),
    ].join("\n");

  function body() {
    if (grid.stores.length === 0 || grid.issues.length === 0) {
      return <p className="py-10 text-center text-sm text-muted-foreground">{gapsOnly ? t("analytics.noGaps") : t("analytics.noCoverageData")}</p>;
    }
    if (asList) {
      return (
        <DataTable
            head={[t("common.store"), t("analytics.issue"), t("analytics.technicians"), t("technicians.standing.emergency"), t("technicians.averageRating"), t("common.gap")]}
            rows={grid.listed.map((c) => [
              c.storeNumber,
              c.title,
              c.technicians,
              c.emergency,
              c.averageRating ?? "—",
              c.gap ? <GapMark key="gap" /> : "—",
            ])}
            numeric={COUNT_COLUMNS}
          />
      );
    }
    return (
          <>
            <Legend />
            <div className="max-h-[70vh] overflow-auto rounded-lg border">
              <table className="border-separate border-spacing-0 text-xs">
                <caption className="sr-only">{t("analytics.coverageGrid")}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky start-0 top-0 z-20 border-b border-e bg-card px-3 py-2 text-start font-medium text-muted-foreground">
                      {t("common.store")}
                    </th>
                    {grid.issues.map((i) => (
                      <th key={i.id} scope="col" className="sticky top-0 z-10 min-w-20 max-w-28 border-b bg-card px-2 py-2 text-center align-bottom font-medium">
                        <span className="line-clamp-3" title={i.title}>{i.title}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.stores.map((store) => (
                    <tr key={store}>
                      <th scope="row" className="sticky start-0 z-10 whitespace-nowrap border-b border-e bg-card px-3 py-1.5 text-start font-medium tabular-nums">
                        {store}
                      </th>
                      {grid.issues.map((i) => {
                        const c = grid.byKey.get(`${store}:${i.id}`);
                        if (!c) return <td key={i.id} className="border-b px-1 py-1" />;
                        const dim = gapsOnly && !c.gap;
                        return (
                          <td key={i.id} className="border-b px-1 py-1">
                            <div
                              title={cellTitle(c)}
                              className={cn(
                                "flex h-10 min-w-16 flex-col items-center justify-center rounded-md tabular-nums",
                                shadeOf(c.technicians),
                                dim && "opacity-30",
                              )}
                            >
                              <span className="flex items-center gap-1 text-sm font-semibold">
                                {c.gap && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                                {c.technicians}
                              </span>
                              {c.gap && <span className="text-[10px] font-semibold uppercase tracking-wide">{t("common.gap")}</span>}
                              <span className="sr-only">{cellTitle(c)}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
    );
  }

  return (
    <div className={cn("space-y-6 transition-opacity duration-200", isRefreshing && "opacity-60")}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile kpi={{ label: t("analytics.techsForStores"), value: k.techniciansForStores, icon: StoreIcon, tint: PEOPLE_TINT, note: t("analytics.techsForStoresNote") }} />
        <KpiTile kpi={{ label: t("analytics.techsForIssues"), value: k.techniciansForIssues, icon: Wrench, tint: PEOPLE_TINT, note: t("analytics.techsForIssuesNote") }} />
        <KpiTile kpi={{ label: t("analytics.techsForBoth"), value: k.techniciansForBoth, icon: HardHat, tint: PEOPLE_TINT, note: t("analytics.techsForBothNote") }} />
        <KpiTile kpi={{ label: t("analytics.emergencyAvailable"), value: k.emergencyAvailable, icon: Siren, tint: PEOPLE_TINT, note: t("analytics.emergencyAvailableNote") }} />
      </div>

      <AnalyticsCard
        icon={Grid3x3}
        title={t("analytics.coverageGrid")}
        count={coverage.gaps}
        description={t("analytics.coverageGridHelp", { gaps: coverage.gaps })}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-52">
              <MultiSelect<number>
                options={catalog.map((i) => ({ value: i.id, label: i.title }))}
                selected={issueIds}
                onChange={(v) => filters.set({ issues: v.length ? v.join(ISSUE_SEPARATOR) : null })}
                placeholder={t("analytics.allIssues")}
                searchPlaceholder={t("analytics.searchIssues")}
                emptyText={t("analytics.noIssueMatch")}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="coverage-gaps-only" checked={gapsOnly} onCheckedChange={(v) => filters.set({ gaps: v ? "1" : null })} />
              <label htmlFor="coverage-gaps-only" className="text-sm">{t("analytics.gapsOnly")}</label>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAsList((v) => !v)} aria-pressed={asList}>
              {asList ? <Grid3x3 className="me-1.5 h-4 w-4" aria-hidden="true" /> : <Table2 className="me-1.5 h-4 w-4" aria-hidden="true" />}
              {asList ? t("analytics.showAsGrid") : t("common.showAsTable")}
            </Button>
          </div>
        }
      >
        {body()}
      </AnalyticsCard>
    </div>
  );
}

function GapMark() {
  const t = useTranslations("maintenanceSystem.common");
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-300">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      {t("gap")}
    </span>
  );
}

/** What the shades mean, each with its words. */
function Legend() {
  const t = useTranslations("maintenanceSystem.analytics");
  const items = [
    { shade: SHADES[0], label: t("legendNone"), gap: true },
    { shade: SHADES[1], label: t("legendOne"), gap: true },
    { shade: SHADES[2], label: t("legendTwo"), gap: false },
    { shade: SHADES[SHADES.length - 1], label: t("legendMore"), gap: false },
  ];
  return (
    <ul className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label={t("legend")}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className={cn("flex h-4 w-6 items-center justify-center rounded", item.shade)} aria-hidden="true">
            {item.gap && <AlertTriangle className="h-2.5 w-2.5" />}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
