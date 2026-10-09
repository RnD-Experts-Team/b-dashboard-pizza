"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDot, Layers, Search, Store, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect, type MultiSelectOption } from "@/components/daily-pay/multi-select";
import { activeFilterCount } from "@/lib/toolbox-tickets/filters-url";
import { useDebouncedValue } from "@/lib/hooks/use-toolbox-tickets-poll";
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
}

export function TicketsFilters({
  filters,
  onChange,
  showStores,
  sections,
  storeOptions,
  currentUserId,
}: TicketsFiltersProps) {
  const t = useTranslations("toolboxTickets.filters");
  const statusLabel = useStatusLabel();

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

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center" data-slot="tickets-filters">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search")}
          className="h-9 ps-8 pe-8"
          aria-label={t("search")}
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

      <div
        className={cn(
          "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center",
          "[&>*]:min-w-0 sm:[&>*]:w-44",
        )}
      >
        <MultiSelect<TicketStatus>
          options={statusOptions}
          selected={filters.statuses}
          onChange={(statuses) => set({ statuses })}
          placeholder={t("status")}
          searchPlaceholder={t("searchIn")}
          emptyText={t("noMatches")}
          icon={<CircleDot className="h-3.5 w-3.5 text-muted-foreground" />}
        />
        <MultiSelect<string>
          options={sectionOptions}
          selected={filters.sectionKeys}
          onChange={(sectionKeys) => set({ sectionKeys })}
          placeholder={t("section")}
          searchPlaceholder={t("searchIn")}
          emptyText={t("noMatches")}
          disabled={!sections}
          icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />}
        />
        {showStores && (
          <MultiSelect<string>
            options={storeOptions}
            selected={filters.stores}
            onChange={(stores) => set({ stores })}
            placeholder={t("store")}
            searchPlaceholder={t("searchIn")}
            emptyText={t("noMatches")}
            icon={<Store className="h-3.5 w-3.5 text-muted-foreground" />}
          />
        )}
        {currentUserId !== null && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={mine}
            onClick={() => set({ reportedBy: mine ? null : currentUserId })}
            className={cn("h-9 justify-start gap-1.5 font-normal", mine && "border-primary/40 bg-primary/5")}
          >
            <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">{t("reportedByMe")}</span>
          </Button>
        )}
        {count > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 justify-start text-muted-foreground sm:w-auto!"
            onClick={() => {
              setSearch("");
              onChange({ ...filters, statuses: [], sectionKeys: [], stores: [], reportedBy: null, search: "", page: 1 });
            }}
          >
            <X className="me-1 h-3.5 w-3.5" />
            {t("clear", { count })}
          </Button>
        )}
      </div>
    </div>
  );
}
