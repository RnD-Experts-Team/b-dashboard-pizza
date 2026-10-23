"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, RefreshCw, RotateCcw, Search, Star, Store, Users, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StoreMultiSelect } from "@/components/hiring/store-multi-select";
import { MinAgeBadge, MinorBadge } from "@/components/skills/skill-badges";
import { SkillCellEditor } from "@/components/skills/skill-cell-editor";
import { SkillsKpis } from "@/components/skills/skills-kpis";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSkillsOverview } from "@/lib/hooks/use-skills-overview";
import {
  EMPTY_FILTERS,
  RATING_FILTERS,
  STATUS_FILTERS,
  activeFilterCount,
  filterEmployees,
  overviewStats,
  skillColumnStats,
  type OverviewFilters,
  type RatingFilter,
  type StatusFilter,
} from "@/lib/skills/overview";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { cn } from "@/lib/utils";
import type { SkillsOverviewEmployee } from "@/types/skills.types";

const STORE_FILTER_KEY = "store-filter:skills";
const SKELETON_HEIGHT = "h-64";
const AVERAGE_DIGITS = 1;

/**
 * The Skills page's overview: employees of the picked stores against every
 * skill, with the employees-page store picker and filter row, a KPI strip, and
 * every cell editable in place for whoever may rate at that employee's store.
 */
export function SkillsOverview() {
  const t = useTranslations("skills");
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const { canAccessRoute, overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();

  // Only stores the caller may read: one refused store would refuse the call.
  const storeOptions = useMemo(
    () =>
      (overviewStores ?? []).flatMap((s) =>
        s.storeId &&
        canAccessRoute({ service: "Operations", method: "GET", path: "/v1/skills/overview", storeId: s.storeId })
          ? [{ storeId: s.storeId, name: s.name || s.storeId }]
          : [],
      ),
    [overviewStores, canAccessRoute],
  );
  const allowed = useMemo(() => new Set(storeOptions.map((s) => s.storeId)), [storeOptions]);

  // What the viewer picked (remembered across visits); null = never picked.
  const [picked, setPicked] = useState<string[] | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_FILTER_KEY) ?? "null");
      return Array.isArray(saved) ? (saved as string[]) : null;
    } catch {
      return null;
    }
  });

  // The pick, clamped to what they may read now; with nothing usable picked,
  // the sidebar store, else every allowed store.
  const selectedStoreIds = useMemo(() => {
    if (picked !== null && picked.length === 0) return [];
    const kept = (picked ?? []).filter((id) => allowed.has(id));
    if (kept.length > 0) return kept;
    const sidebar = selectedStore?.storeId;
    return sidebar && allowed.has(sidebar) ? [sidebar] : [...allowed];
  }, [picked, allowed, selectedStore?.storeId]);

  const applyStores = (ids: string[]) => {
    setPicked(ids);
    try {
      localStorage.setItem(STORE_FILTER_KEY, JSON.stringify(ids));
    } catch {}
  };

  const { data, isLoading, error, refetch, rate, remove } = useSkillsOverview(
    selectedStoreIds.length > 0 ? selectedStoreIds : null,
  );

  const [filters, setFilters] = useState<OverviewFilters>(EMPTY_FILTERS);
  const setFilter = <K extends keyof OverviewFilters>(key: K, value: OverviewFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const toggleStatus = (status: StatusFilter) =>
    setFilter("status", filters.status === status ? "all" : status);

  const skills = useMemo(() => data?.skills ?? [], [data]);
  const employees = useMemo(() => data?.employees ?? [], [data]);
  const visible = useMemo(() => filterEmployees(employees, skills, filters), [employees, skills, filters]);
  const stats = useMemo(() => overviewStats(employees, skills), [employees, skills]);
  const filterCount = activeFilterCount(filters);
  const multiStore = selectedStoreIds.length > 1;
  const storeNames = useMemo(() => new Map(storeOptions.map((s) => [s.storeId, s.name])), [storeOptions]);

  // Rating writes through a store the employee works at and the caller may rate at.
  const rateStoreFor = (e: SkillsOverviewEmployee): string | null =>
    e.store_numbers.find((code) =>
      canAccessRoute({ service: "Operations", method: "POST", path: "/v1/stores/*/employees/*/skills/*", storeId: code }),
    ) ?? null;

  if (storeOptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <Store className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("noOverviewAccess")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Filter row (the /employees top bar) ── */}
      <div className="flex flex-wrap items-center gap-2" data-slot="skills-filters">
        <StoreMultiSelect stores={storeOptions} value={selectedStoreIds} onApply={applyStores} />

        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-9 ps-9"
          />
        </div>

        <Select value={filters.status} onValueChange={(v) => setFilter("status", v as StatusFilter)}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.skill} onValueChange={(v) => setFilter("skill", v)}>
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSkills")}</SelectItem>
            {skills.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.rating} onValueChange={(v) => setFilter("rating", v as RatingFilter)}>
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RATING_FILTERS.map((r) => (
              <SelectItem key={r} value={r}>
                {r === "any" || r === "none" ? t(`rating.${r}`) : t("rating.atLeast", { stars: r })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filterCount > 0 && (
          <>
            <Badge variant="secondary" className="h-6 px-2 text-xs tabular-nums">
              {t("activeFilters", { count: filterCount })}
            </Badge>
            <Button variant="ghost" className="h-9 text-muted-foreground" onClick={() => setFilters(EMPTY_FILTERS)}>
              <X className="me-1 h-4 w-4" />
              {t("clearAll")}
            </Button>
          </>
        )}

        <Button variant="outline" size="icon" className="h-9 w-9" onClick={refetch} aria-label={t("refresh")}>
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {selectedStoreIds.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <Store className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("selectStore")}</p>
        </div>
      )}

      {selectedStoreIds.length > 0 && isLoading && !data && (
        <Skeleton className={cn(SKELETON_HEIGHT, "w-full rounded-lg")} />
      )}

      {error && !data && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("loadFailed")}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {error.message}
            <Button size="sm" variant="outline" onClick={refetch}>
              <RotateCcw className="me-1.5 h-3.5 w-3.5" />
              {t("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {data && (
        <>
          <SkillsKpis
            stats={stats}
            skillCount={skills.length}
            activeStatus={filters.status}
            onShowAlerts={() => toggleStatus("alerts")}
            onShowMinors={() => toggleStatus("minors")}
          />

          {stats.alerted > 0 && (
            <Alert className="border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/15">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle>{t("overviewAlertTitle", { count: stats.alerted })}</AlertTitle>
              <AlertDescription>{t("overviewAlertBody")}</AlertDescription>
            </Alert>
          )}

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {employees.length === 0 ? t("noEmployees") : t("noMatches")}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {t("showingCount", { shown: visible.length, total: employees.length })}
              </p>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-44">{t("employee")}</TableHead>
                      {multiStore && <TableHead className="min-w-32">{t("stores")}</TableHead>}
                      {skills.map((skill) => {
                        const col = skillColumnStats(visible, skill);
                        return (
                          <TableHead key={skill.id} className="min-w-24 text-center">
                            <div className="flex flex-col items-center gap-1 py-1">
                              <span>{skill.name}</span>
                              {skill.min_age !== null && <MinAgeBadge minAge={skill.min_age} />}
                              <span className="text-[10px] font-normal tabular-nums text-muted-foreground">
                                {col.average === null
                                  ? t("columnNone")
                                  : t("columnStats", { average: col.average.toFixed(AVERAGE_DIGITS), rated: col.rated })}
                              </span>
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((employee) => {
                      const alerts = new Set(employee.alert_skill_ids);
                      const restricted = new Set(employee.restricted_skill_ids);
                      const rateStore = rateStoreFor(employee);
                      const profileStore = rateStore ?? employee.store_numbers[0];
                      return (
                        <TableRow
                          key={employee.id}
                          className={cn(alerts.size > 0 && "bg-amber-500/5 dark:bg-amber-500/10")}
                        >
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              {profileStore ? (
                                <Link
                                  href={`/${locale}/dashboard/employee-profile?storeId=${encodeURIComponent(profileStore)}&employeeId=${employee.id}`}
                                  className="font-medium hover:underline"
                                >
                                  {employee.name}
                                </Link>
                              ) : (
                                <span className="font-medium">{employee.name}</span>
                              )}
                              {employee.is_minor === true && <MinorBadge />}
                            </div>
                          </TableCell>
                          {multiStore && (
                            <TableCell className="text-xs text-muted-foreground">
                              {employee.store_numbers.map((code) => storeNames.get(code) ?? code).join(", ")}
                            </TableCell>
                          )}
                          {skills.map((skill) => {
                            const rated = employee.ratings[skill.id];
                            const alert = alerts.has(skill.id);
                            const content = (
                              <span className="inline-flex items-center gap-1">
                                {alert && <AlertTriangle className="h-3.5 w-3.5" />}
                                {rated ? (
                                  <>
                                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                    {rated.rating}
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </span>
                            );
                            return (
                              <TableCell
                                key={skill.id}
                                title={alert ? skill.restriction_note ?? undefined : rated?.notes ?? undefined}
                                className={cn(
                                  "p-0 text-center tabular-nums",
                                  alert && "bg-amber-500/15 font-medium text-amber-800 dark:text-amber-300",
                                )}
                              >
                                {rateStore ? (
                                  <SkillCellEditor
                                    employeeName={employee.name}
                                    skill={skill}
                                    rating={rated?.rating ?? null}
                                    notes={rated?.notes ?? null}
                                    restricted={restricted.has(skill.id)}
                                    onSave={(stars, notes) => rate(rateStore, employee.id, skill.id, stars, notes)}
                                    onRemove={() => remove(rateStore, employee.id, skill.id)}
                                  >
                                    <button
                                      type="button"
                                      className="h-full w-full px-2 py-2 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                                      aria-label={t("rateCell", { skill: skill.name, employee: employee.name })}
                                    >
                                      {content}
                                    </button>
                                  </SkillCellEditor>
                                ) : (
                                  <div className="px-2 py-2">{content}</div>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
