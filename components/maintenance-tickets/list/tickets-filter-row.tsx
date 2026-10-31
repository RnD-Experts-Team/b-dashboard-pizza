"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { OverviewStore } from "@/lib/api/services/auth.service";
import { useTechnicianCategories, useTechnicians } from "@/lib/hooks/use-maintenance-catalog";
import { ISSUE_STATUSES, PRIORITIES, vocabOptions, vocabText } from "@/lib/maintenance/vocabulary";
import type { IssueStatus, Priority, TicketsFilters } from "@/types/maintenance-tickets.types";
import { TicketsSearch } from "../tickets-search";
import { FilterMulti } from "./filter-multi";

const TECHNICIAN_PAGE_SIZE = 500;
/** Sent as technician_ids when a category has nobody in it: matches no ticket. */
export const NO_TECHNICIAN = 0;

/** Everyone in a category, or a match-nobody id when it is empty. */
function idsOrNobody(ids: number[]): number[] {
  return ids.length ? ids : [NO_TECHNICIAN];
}

/**
 * The tickets list's one flat filter row (UI doc §1): search, Status,
 * Store, Priority, Technician, Category (technician category), Clear all.
 * Category is a shortcut: picking one narrows the Technician options and
 * filters by everyone in it until specific technicians are picked.
 */
export function TicketsFilterRow({
  filters,
  onFiltersChange,
  stores,
  selectedStoreIds,
  onStoresChange,
  categoryId,
  onCategoryChange,
  canFilterTechnicians,
  isSearching,
  disabled,
}: {
  filters: TicketsFilters;
  onFiltersChange: (next: TicketsFilters) => void;
  stores: OverviewStore[];
  selectedStoreIds: string[];
  onStoresChange: (ids: string[]) => void;
  categoryId: number | null;
  onCategoryChange: (categoryId: number | null, technicianIds: number[] | undefined) => void;
  canFilterTechnicians: boolean;
  isSearching: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("maintenanceSystem");
  const { categories } = useTechnicianCategories(canFilterTechnicians);
  const { technicians } = useTechnicians({ perPage: TECHNICIAN_PAGE_SIZE }, canFilterTechnicians);
  const inCategory = useMemo(
    () => (categoryId ? technicians.filter((tech) => tech.categoryId === categoryId || tech.category?.id === categoryId) : technicians),
    [technicians, categoryId],
  );
  const categoryIds = inCategory.map((tech) => tech.id);
  const pickedTechs = (filters.technician_ids ?? []).filter((id) => id !== NO_TECHNICIAN);
  const allOfCategory = Boolean(categoryId) && pickedTechs.length === categoryIds.length && categoryIds.every((id) => pickedTechs.includes(id));
  const categoryFallback = categoryId ? idsOrNobody(categoryIds) : undefined;
  const everyStore = stores.length > 0 && selectedStoreIds.length === stores.length;

  const set = (patch: Partial<TicketsFilters>) => onFiltersChange({ ...filters, ...patch, page: 1 });
  const hasAny = Boolean(
    filters.q || filters.statuses?.length || filters.priorities?.length || filters.technician_ids?.length || filters.issue_statuses?.length || filters.assigned_to || categoryId,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TicketsSearch
        value={filters.q ?? ""}
        onChange={(q) => set({ q: q || undefined })}
        isSearching={isSearching}
        disabled={disabled}
        className="w-full sm:w-64"
      />
      <FilterMulti<IssueStatus>
        label={t("common.status")}
        allLabel={t("tickets.list.all")}
        options={vocabOptions(ISSUE_STATUSES).map((s) => ({ value: s.value, label: vocabText(t, s) }))}
        value={filters.statuses ?? []}
        onChange={(v) => set({ statuses: v.length ? v : undefined })}
        disabled={disabled}
      />
      {stores.length > 1 ? (
        <FilterMulti<string>
          label={t("common.store")}
          allLabel={t("tickets.list.allStores")}
          options={stores.map((s) => {
            const id = s.storeId ?? s.id;
            return { value: id, label: s.name ? `${id} · ${s.name}` : id };
          })}
          value={everyStore ? [] : selectedStoreIds}
          onChange={onStoresChange}
          disabled={disabled}
          deferred
        />
      ) : null}
      <FilterMulti<Priority>
        label={t("common.priority")}
        allLabel={t("tickets.list.all")}
        options={vocabOptions(PRIORITIES).map((p) => ({ value: p.value, label: vocabText(t, p) }))}
        value={filters.priorities ?? []}
        onChange={(v) => set({ priorities: v.length ? v : undefined })}
        disabled={disabled}
      />
      {canFilterTechnicians ? (
        <>
          <FilterMulti<number>
            label={t("vocab.terms.technician.label")}
            allLabel={categoryId ? t("tickets.list.allInCategory") : t("tickets.list.all")}
            options={inCategory.map((tech) => ({ value: tech.id, label: tech.name }))}
            value={allOfCategory ? [] : pickedTechs}
            onChange={(v) => set({ technician_ids: v.length ? v : categoryFallback })}
            disabled={disabled}
          />
          <FilterMulti<number>
            label={t("common.category")}
            allLabel={t("tickets.list.all")}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={categoryId ? [categoryId] : []}
            single
            onChange={(v) => {
              const next = v[0] ?? null;
              if (!next) return onCategoryChange(null, undefined);
              const ids = technicians.filter((tech) => tech.categoryId === next || tech.category?.id === next).map((tech) => tech.id);
              onCategoryChange(next, idsOrNobody(ids));
            }}
            disabled={disabled}
          />
        </>
      ) : null}
      {hasAny ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => {
            onCategoryChange(null, undefined);
            onFiltersChange({ page: 1 });
          }}
          disabled={disabled}
        >
          <X className="me-1 h-3.5 w-3.5" aria-hidden="true" />
          {t("common.clearAll")}
        </Button>
      ) : null}
    </div>
  );
}
