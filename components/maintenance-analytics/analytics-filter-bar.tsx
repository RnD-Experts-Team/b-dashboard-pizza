"use client";

import { ArrowRight, CalendarDays, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StoreMultiSelect } from "@/components/business-reports/store-multi-select";
import { useTechnicianCategories } from "@/lib/hooks/use-maintenance-catalog";
import { matchPreset, presetDays, type RangePreset } from "@/lib/maintenance-tickets/local-range";
import type { AnalyticsFilters } from "./use-analytics-filters";

const PRESETS: RangePreset[] = ["yesterday", "last7", "last30", "thisMonth", "thisYear"];
const PRESET_OPTIONS = PRESETS.map((id) => ({ id, label: id }));
const ALL = "all";

/**
 * The analytics page's one filter row (docs/MAINTENANCE-UI.md §8): the
 * days (presets or two dates), the stores, the technician category. A tab
 * that does not use one of them says so instead of silently ignoring it.
 */
export function AnalyticsFilterBar({ filters }: { filters: AnalyticsFilters }) {
  const t = useTranslations("maintenanceSystem.analytics");
  const { categories } = useTechnicianCategories();
  const usesDates = filters.tab !== "coverage";
  const usesCategory = filters.tab !== "overview";
  const active = matchPreset(filters.from, filters.to, undefined, PRESET_OPTIONS);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-card px-4 py-3 shadow-sm" role="search">
        {usesDates && (
          <>
            <div role="group" aria-label={t("dateRange")} className="inline-flex flex-wrap rounded-lg border bg-muted/50 p-0.5">
              {PRESETS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active === id}
                  onClick={() => {
                    const days = presetDays(id);
                    filters.setRange(days.startDate, days.endDate);
                  }}
                  className={cn(
                    "cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`presets.${id}`)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">{t("from")}</span>
              <DatePicker
                value={filters.from}
                onChange={(v) => v && filters.setRange(v, v > filters.to ? v : filters.to)}
                className="w-36"
              />
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
              <span className="sr-only">{t("to")}</span>
              <DatePicker
                value={filters.to}
                onChange={(v) => v && filters.setRange(v < filters.from ? v : filters.from, v)}
                className="w-36"
              />
            </div>
          </>
        )}

        <StoreMultiSelect
          options={filters.storeOptions.map((o) => ({ id: o.value, name: o.label }))}
          value={filters.stores.length ? filters.stores : "all"}
          onChange={(v) => filters.setStores(v === "all" || v.length === 0 ? "all" : v)}
          className="w-48"
        />

        {usesCategory && (
          <Select value={filters.categoryId ? String(filters.categoryId) : ALL} onValueChange={(v) => filters.setCategory(v === ALL ? null : Number(v))}>
            <SelectTrigger className="w-44" aria-label={t("technicianCategory")}><SelectValue /></SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              <SelectItem value={ALL}>{t("allCategories")}</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      {!usesDates && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          {t("coverageAsOfNow")}
        </p>
      )}
    </div>
  );
}
