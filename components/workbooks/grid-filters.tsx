"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Filter, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/shared/searchable-select";
import type { RowsQuery, WorkbookColumn } from "@/types/workbooks.types";

const ANY = "__any__";

interface GridFiltersProps {
  columns: WorkbookColumn[];
  query: RowsQuery;
  onChange: (patch: Partial<RowsQuery>) => void;
  onClearAll: () => void;
}

function sameFilters(a: Record<string, string>, b: Record<string, string>) {
  const ka = Object.keys(a).filter((k) => a[k] !== "");
  const kb = Object.keys(b).filter((k) => b[k] !== "");
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

/**
 * Global search + a collapsible per-column filter panel. Inputs are
 * debounced (300ms) and sent as typed. The server IGNORES an unparseable
 * filter rather than rejecting it, so a half-typed number just doesn't filter
 * yet — no error to show, and "nothing filtered" doesn't prove it was valid.
 */
export function GridFilters({ columns, query, onChange, onClearAll }: GridFiltersProps) {
  const t = useTranslations("workbooks.grid");
  const tc = useTranslations("workbooks.common");
  const [search, setSearch] = useState(query.search ?? "");
  const [filters, setFilters] = useState<Record<string, string>>(query.filters);
  const columnFilterCount = Object.values(query.filters).filter((v) => v !== "").length;
  const [open, setOpen] = useState(columnFilterCount > 0);
  const prevCount = useRef(columnFilterCount);

  // Follow the URL (back/forward, "Clear filters" elsewhere).
  useEffect(() => setSearch(query.search ?? ""), [query.search]);
  useEffect(() => setFilters(query.filters), [query.filters]);

  // Auto-expand the moment any filter becomes active.
  useEffect(() => {
    if (columnFilterCount > 0 && prevCount.current === 0) setOpen(true);
    prevCount.current = columnFilterCount;
  }, [columnFilterCount]);

  // Debounced push of search + text-ish filters.
  useEffect(() => {
    const id = setTimeout(() => {
      const searchChanged = (search ?? "") !== (query.search ?? "");
      const filtersChanged = !sameFilters(filters, query.filters);
      if (searchChanged || filtersChanged) {
        onChange({ search, filters, page: 1 });
      }
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters]);

  /** Discrete controls (date, boolean, select) apply at once. */
  const setNow = (columnId: number, value: string) => {
    const next = { ...filters, [String(columnId)]: value };
    if (value === "") delete next[String(columnId)];
    setFilters(next);
    onChange({ filters: next, page: 1 });
  };

  const setTyped = (columnId: number, value: string) => {
    const next = { ...filters, [String(columnId)]: value };
    if (value === "") delete next[String(columnId)];
    setFilters(next);
  };

  const anyActive = columnFilterCount > 0 || Boolean(query.search?.trim());

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-9 ps-8 pe-8"
            aria-label={t("searchPlaceholder")}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={tc("clear")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("h-9 flex-1 sm:flex-none", columnFilterCount > 0 && "border-primary/40 bg-primary/5")}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <Filter className="me-1.5 h-3.5 w-3.5" />
            {t("filters")}
            {columnFilterCount > 0 && (
              <Badge variant="secondary" className="ms-1.5 h-4 px-1.5 text-[10px] tabular-nums">
                {columnFilterCount}
              </Badge>
            )}
            <ChevronDown className={cn("ms-1.5 h-3.5 w-3.5 transition-transform duration-150", open && "rotate-180")} />
          </Button>
          {anyActive && (
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={onClearAll}>
              {t("clearFilters")}
            </Button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-1 gap-3 border-t bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
            {columns.map((c) => {
              const value = filters[String(c.id)] ?? "";
              const active = value !== "";
              return (
                <div key={c.id} className="min-w-0 space-y-1">
                  <label className="block truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {c.name}
                  </label>
                  {c.type === "boolean" ? (
                    <div className="flex gap-1" role="group" aria-label={c.name}>
                      {[
                        { v: "", label: tc("any") },
                        { v: "true", label: tc("yes") },
                        { v: "false", label: tc("no") },
                      ].map((o) => (
                        <button
                          key={o.v || "any"}
                          type="button"
                          aria-pressed={value === o.v}
                          onClick={() => setNow(c.id, o.v)}
                          className={cn(
                            "inline-flex h-9 flex-1 items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors",
                            value === o.v
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  ) : c.type === "select" ? (
                    <SearchableSelect<string>
                      options={[
                        { value: ANY, label: tc("any") },
                        ...(c.options ?? []).map((o) => ({ value: o, label: o })),
                      ]}
                      value={value || ANY}
                      onChange={(v) => setNow(c.id, v === ANY ? "" : v)}
                      searchPlaceholder={tc("search")}
                      emptyText={tc("noResults")}
                      className={cn(active && "border-primary/40 bg-primary/5")}
                    />
                  ) : c.type === "date" ? (
                    <div className="flex items-center gap-1">
                      <DatePicker
                        value={value}
                        onChange={(v) => setNow(c.id, v)}
                        className={cn("min-w-0 flex-1", active && "[&_input]:border-primary/40 [&_input]:bg-primary/5")}
                      />
                      {active && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => setNow(c.id, "")}
                          aria-label={tc("clear")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Input
                      value={value}
                      inputMode={c.type === "number" ? "decimal" : undefined}
                      onChange={(e) => setTyped(c.id, e.target.value)}
                      placeholder={c.type === "number" ? t("exactNumber") : t("contains")}
                      className={cn("h-9", active && "border-primary/40 bg-primary/5")}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
