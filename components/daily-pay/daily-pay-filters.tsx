"use client";

import { useState } from "react";
import {
  Plus,
  SlidersHorizontal,
  X,
  ChevronDown,
  Users,
  Store,
  CalendarDays,
  ArrowDownUp,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "./multi-select";
import type { DailyPayFilters } from "@/types/daily-pay.types";
import type { CatalogTechnician } from "@/types/maintenance-tickets.types";
import type { DailyPayStoreOption } from "@/lib/hooks/use-daily-pay";

interface DailyPayFiltersBarProps {
  filters: DailyPayFilters;
  onFiltersChange: (filters: DailyPayFilters) => void;
  onCreateClick: () => void;
  stores: DailyPayStoreOption[];
  technicians: CatalogTechnician[];
  disabled?: boolean;
  canCreate?: boolean;
}

export function DailyPayFiltersBar({
  filters,
  onFiltersChange,
  onCreateClick,
  stores,
  technicians,
  disabled,
  canCreate = true,
}: DailyPayFiltersBarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function updateField<K extends keyof DailyPayFilters>(
    key: K,
    value: DailyPayFilters[K]
  ) {
    onFiltersChange({ ...filters, [key]: value });
  }

  const advancedCount = [
    filters.date,
    filters.date_from,
    filters.date_to,
    filters.sort,
    filters.dir,
    filters.per_page,
  ].filter((v) => v != null && v !== "").length;

  const totalActive =
    (filters.technician_ids?.length ? 1 : 0) +
    (filters.store_ids?.length ? 1 : 0) +
    advancedCount;

  const hasAnyFilter = totalActive > 0;

  return (
    <div className="space-y-2">
      {/* ── Main toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Technicians */}
        <div className="w-full sm:w-52">
          <MultiSelect
            options={technicians.map((t) => ({
              value: t.id,
              label: t.name,
              hint: t.categoryName ?? undefined,
            }))}
            selected={filters.technician_ids ?? []}
            onChange={(vals) =>
              updateField("technician_ids", vals.length ? vals : undefined)
            }
            placeholder="All technicians"
            searchPlaceholder="Search technicians…"
            emptyText="No technicians."
            icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />}
            disabled={disabled}
          />
        </div>

        {/* Stores */}
        <div className="w-full sm:w-52">
          <MultiSelect
            options={stores.map((s) => ({
              value: s.id,
              label: s.storeNumber,
              hint: s.name,
            }))}
            selected={filters.store_ids ?? []}
            onChange={(vals) =>
              updateField("store_ids", vals.length ? vals : undefined)
            }
            placeholder="All stores"
            searchPlaceholder="Search stores…"
            emptyText="No stores."
            icon={<Store className="h-3.5 w-3.5 text-muted-foreground" />}
            disabled={disabled}
          />
        </div>

        {/* Advanced filters toggle */}
        <Button
          variant={advancedOpen ? "secondary" : "outline"}
          size="sm"
          onClick={() => setAdvancedOpen((v) => !v)}
          disabled={disabled}
          className={cn(
            "h-9 gap-1.5",
            advancedCount > 0 && !advancedOpen && "border-primary/40 bg-primary/5 text-primary"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filters</span>
          {advancedCount > 0 ? (
            <Badge variant="default" className="h-4 min-w-4 px-1 text-[10px] leading-none">
              {advancedCount}
            </Badge>
          ) : (
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                advancedOpen && "rotate-180"
              )}
            />
          )}
        </Button>

        {/* Clear all */}
        {hasAnyFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFiltersChange({})}
            disabled={disabled}
            className="h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            <span className="text-xs">Clear</span>
          </Button>
        )}

        {/* Right side actions */}
        {canCreate && (
          <div className="ms-auto flex items-center gap-2">
            <Button size="sm" onClick={onCreateClick} disabled={disabled} className="h-9 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Entry</span>
            </Button>
          </div>
        )}
      </div>

      {/* ── Advanced panel ───────────────────────────────────────────── */}
      {advancedOpen && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Filters
              </span>
              {advancedCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {advancedCount} active
                </Badge>
              )}
            </div>
          </div>

          <div className="grid gap-x-4 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Exact date */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                Workday date
              </label>
              <DatePicker
                value={filters.date ?? ""}
                onChange={(v) => updateField("date", v || undefined)}
                placeholder="YYYY-MM-DD"
                disabled={disabled}
              />
            </div>

            {/* Date from */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                Date from
              </label>
              <DatePicker
                value={filters.date_from ?? ""}
                onChange={(v) => updateField("date_from", v || undefined)}
                placeholder="YYYY-MM-DD"
                disabled={disabled}
              />
            </div>

            {/* Date to */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                Date to
              </label>
              <DatePicker
                value={filters.date_to ?? ""}
                onChange={(v) => updateField("date_to", v || undefined)}
                placeholder="YYYY-MM-DD"
                disabled={disabled}
              />
            </div>

            {/* Sort column */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ArrowDownUp className="h-3 w-3" />
                Sort by
              </label>
              <Select
                value={filters.sort ?? "default"}
                onValueChange={(v) =>
                  updateField("sort", v === "default" ? undefined : (v as DailyPayFilters["sort"]))
                }
                disabled={disabled}
              >
                <SelectTrigger className={cn("h-9 text-sm", filters.sort && "border-primary/40 bg-primary/5")}>
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="date">Workday date</SelectItem>
                  <SelectItem value="created_at">Created at</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Direction */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ArrowDownUp className="h-3 w-3" />
                Direction
              </label>
              <Select
                value={filters.dir ?? "default"}
                onValueChange={(v) =>
                  updateField("dir", v === "default" ? undefined : (v as DailyPayFilters["dir"]))
                }
                disabled={disabled}
              >
                <SelectTrigger className={cn("h-9 text-sm", filters.dir && "border-primary/40 bg-primary/5")}>
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="desc">Newest first</SelectItem>
                  <SelectItem value="asc">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Per page */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <List className="h-3 w-3" />
                Results per page
              </label>
              <Select
                value={filters.per_page != null ? String(filters.per_page) : "default"}
                onValueChange={(v) =>
                  updateField("per_page", v === "default" ? undefined : Number(v))
                }
                disabled={disabled}
              >
                <SelectTrigger className={cn("h-9 text-sm", filters.per_page != null && "border-primary/40 bg-primary/5")}>
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
