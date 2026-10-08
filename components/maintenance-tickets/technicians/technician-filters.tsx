"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StoreOption } from "@/components/business-reports/store-multi-select";
import { AnalyticsControls } from "@/components/maintenance-tickets/analytics/analytics-controls";
import { useAuthStore } from "@/lib/auth/auth.store";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";
import { LONG_RANGE_PRESETS, RANGE_PRESETS, daysToInstants, matchPreset, presetDays } from "@/lib/maintenance-tickets/local-range";
import type { StoreSelection } from "@/types/business-reports.types";
import type { CatalogCategory, CatalogIssue } from "@/types/maintenance-tickets.types";
import type { TechnicianAnalyticsParams } from "@/types/technician-analytics.types";

const ALL = "all";
const PRESETS = [...LONG_RANGE_PRESETS];

/** The Technicians pages' filters: days, stores, an issue and (on the list) a trade. */
export function useTechnicianFilters() {
  const overviewStores = useAuthStore((s) => s.overviewStores);
  const storeOptions: StoreOption[] = useMemo(
    () =>
      (overviewStores ?? [])
        .filter((s) => s.isActive && s.storeId)
        .map((s) => ({ id: s.storeId as string, name: s.name ? `${s.storeId} · ${s.name}` : (s.storeId as string) })),
    [overviewStores],
  );

  const initial = useMemo(() => presetDays("thisMonth"), []);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [selection, setSelection] = useState<StoreSelection>("all");
  const [issueId, setIssueId] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);

  const params: TechnicianAnalyticsParams | null = useMemo(() => {
    const range = daysToInstants(startDate, endDate);
    if (!range) return null;
    return {
      from: range.from,
      to: range.to,
      dateFrom: startDate,
      dateTo: endDate,
      // "All stores" sends none: every store, including ones no longer listed.
      stores: selection === "all" ? [] : selection,
      issueIds: issueId === ALL ? [] : [Number(issueId)],
      categoryIds: categoryId === ALL ? [] : [Number(categoryId)],
    };
  }, [startDate, endDate, selection, issueId, categoryId]);

  const preset = matchPreset(startDate, endDate, undefined, PRESETS);
  const rangeLabel = [...PRESETS, ...RANGE_PRESETS].find((p) => p.id === preset)?.label ?? "This range";

  return {
    storeOptions,
    startDate,
    endDate,
    setRange: (s: string, e: string) => { setStartDate(s); setEndDate(e); },
    selection,
    setSelection,
    issueId,
    setIssueId,
    categoryId,
    setCategoryId,
    params,
    rangeLabel,
  };
}

export function TechnicianFilters({
  filters,
  showTrade,
  isUpdating,
}: {
  filters: ReturnType<typeof useTechnicianFilters>;
  showTrade: boolean;
  isUpdating: boolean;
}) {
  const [issues, setIssues] = useState<CatalogIssue[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);

  useEffect(() => {
    maintenanceTicketsService.getCatalogIssues().then((all) => setIssues(all.filter((i) => !i.deletedAt).sort((a, b) => a.title.localeCompare(b.title)))).catch(() => setIssues([]));
    if (showTrade) maintenanceTicketsService.getCatalogCategories().then(setCategories).catch(() => setCategories([]));
  }, [showTrade]);

  return (
    <AnalyticsControls
      storeOptions={filters.storeOptions}
      selection={filters.selection}
      onSelectionChange={filters.setSelection}
      startDate={filters.startDate}
      endDate={filters.endDate}
      onRangeChange={filters.setRange}
      isUpdating={isUpdating}
      presets={PRESETS}
    >
      <Select value={filters.issueId} onValueChange={filters.setIssueId}>
        <SelectTrigger className="w-44" aria-label="Issue"><SelectValue /></SelectTrigger>
        <SelectContent position="popper" style={{ maxHeight: 300, overflowY: "auto" }}>
          <SelectItem value={ALL}>All issues</SelectItem>
          {issues.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.title}</SelectItem>)}
        </SelectContent>
      </Select>
      {showTrade && (
        <Select value={filters.categoryId} onValueChange={filters.setCategoryId}>
          <SelectTrigger className="w-40" aria-label="Trade"><SelectValue /></SelectTrigger>
          <SelectContent position="popper" style={{ maxHeight: 300, overflowY: "auto" }}>
            <SelectItem value={ALL}>All trades</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </AnalyticsControls>
  );
}
