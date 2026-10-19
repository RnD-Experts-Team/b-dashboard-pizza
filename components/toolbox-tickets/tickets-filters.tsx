"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MultiSelectOption } from "@/components/daily-pay/multi-select";
import { activeFilterCount } from "@/lib/toolbox-tickets/filters-url";
import { useDebouncedValue } from "@/lib/hooks/use-toolbox-tickets-poll";
import { AllMultiSelect } from "./filter-multi-select";
import { useStatusLabel } from "./ticket-status-badge";
import {
  TICKET_STATUSES,
  type TicketListFilters,
  type TicketSection,
  type TicketStatus,
} from "@/types/toolbox-tickets.types";

interface TicketsFiltersProps {
  filters: TicketListFilters;
  onChange: (next: TicketListFilters) => void;
  /** Inbox shows the store filter; the store queue has the store in its path. */
  showStores: boolean;
  sections: TicketSection[] | null;
  storeOptions: MultiSelectOption<string>[];
  currentUserId: number | null;
  /** Extra buttons at the end of the row (e.g. Refresh). */
  actions?: ReactNode;
}

/**
 * One row of controls, like the /employees top bar: search, the filters,
 * then Clear all and Refresh. An empty selection is drawn as "All …" with
 * everything checked (see AllMultiSelect) — the real state stays `[]`.
 */
export function TicketsFilters({
  filters,
  onChange,
  showStores,
  sections,
  storeOptions,
  currentUserId,
  actions,
}: TicketsFiltersProps) {
  const t = useTranslations("toolboxTickets.filters");
  const statusLabel = useStatusLabel();
  const searchId = useId();

  // Search is typed locally and committed debounced — one request per pause.
  const [search, setSearch] = useState(filters.search);
  const debounced = useDebouncedValue(search, 400);
  useEffect(() => setSearch(filters.search), [filters.search]);
  useEffect(() => {
    if (debounced.trim() !== filters.search.trim()) onChange({ ...filters, search: debounced, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const set = (patch: Partial<TicketListFilters>) => onChange({ ...filters, ...patch, page: 1 });

  const statusOptions = useMemo<MultiSelectOption<TicketStatus>[]>(
    () => TICKET_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
    [statusLabel],
  );
  const sectionOptions = useMemo<MultiSelectOption<string>[]>(
    () => (sections ?? []).map((s) => ({ value: s.key, label: s.name, hint: s.key })),
    [sections],
  );

  const count = activeFilterCount(filters, { includeStores: showStores });
  const mine = currentUserId !== null && filters.reportedBy === currentUserId;
  const anyReporter = filters.reportedBy === null;

  const segment = (active: boolean) =>
    cn(
      "truncate rounded-md px-3 text-xs transition-all",
      active ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
    );

  const clearAll = () => {
    setSearch("");
    onChange({ ...filters, statuses: [], sectionKeys: [], stores: [], reportedBy: null, search: "", page: 1 });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-slot="tickets-filters">
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={searchId}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search")}
          aria-label={t("field.search")}
          className="h-9 ps-9 pe-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label={t("clearSearch")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="w-full sm:w-44">
        <AllMultiSelect<TicketStatus>
          options={statusOptions}
          selected={filters.statuses}
          onChange={(statuses) => set({ statuses })}
          allLabel={t("all.statuses")}
          countLabel={(n) => t("n.statuses", { count: n })}
          searchPlaceholder={t("searchIn")}
          emptyText={t("noMatches")}
          aria-label={t("field.status")}
        />
      </div>
      <div className="w-full sm:w-44">
        <AllMultiSelect<string>
          options={sectionOptions}
          selected={filters.sectionKeys}
          onChange={(sectionKeys) => set({ sectionKeys })}
          allLabel={t("all.areas")}
          countLabel={(n) => t("n.areas", { count: n })}
          searchPlaceholder={t("searchIn")}
          emptyText={t("noMatches")}
          disabled={!sections}
          loadingLabel={t("loading")}
          aria-label={t("field.area")}
        />
      </div>
      {showStores && (
        <div className="w-full sm:w-44">
          <AllMultiSelect<string>
            options={storeOptions}
            selected={filters.stores}
            onChange={(stores) => set({ stores })}
            allLabel={t("all.stores")}
            countLabel={(n) => t("n.stores", { count: n })}
            searchPlaceholder={t("searchIn")}
            emptyText={t("noMatches")}
            aria-label={t("field.store")}
          />
        </div>
      )}
      {currentUserId !== null && (
        <div role="group" aria-label={t("field.reportedBy")} className="flex h-9 gap-0.5 rounded-lg bg-muted/60 p-0.5">
          <button
            type="button"
            aria-pressed={anyReporter}
            onClick={() => !anyReporter && set({ reportedBy: null })}
            className={segment(anyReporter)}
          >
            {t("all.reporters")}
          </button>
          <button
            type="button"
            aria-pressed={mine}
            onClick={() => !mine && set({ reportedBy: currentUserId })}
            className={segment(mine)}
          >
            {t("reportedByMe")}
          </button>
        </div>
      )}

      {count > 0 && (
        <>
          <Badge variant="secondary" className="h-6 px-2 text-xs tabular-nums">
            {t("active", { count })}
          </Badge>
          <Button type="button" variant="ghost" className="h-9 text-muted-foreground" onClick={clearAll}>
            <X className="me-1 h-4 w-4" />
            {t("reset")}
          </Button>
        </>
      )}
      {actions}
    </div>
  );
}
