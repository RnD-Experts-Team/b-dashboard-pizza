"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  BookOpen,
  SlidersHorizontal,
  X,
  Store,
  ChevronDown,
  User,
  DollarSign,
  Trash2,
  List,
  AlertCircle,
  CircleDot,
  Flag,
  Check,
  Search,
} from "lucide-react";
import type { CatalogIssue, CatalogTechnician, TicketsFilters, TicketType, TicketStatus, Priority, IssueStatus } from "@/types/maintenance-tickets.types";
import type { OverviewStore } from "@/lib/api/services/auth.service";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Searchable Select                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

interface SearchableSelectOption {
  value: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled,
  active,
  className,
  icon,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = search.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.subLabel?.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  useEffect(() => {
    if (open) {
      setSearch("");
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            active && "border-primary/40 bg-primary/5",
            className
          )}
        >
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
          <span className={cn("flex-1 truncate text-start", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            className={cn(
              "ms-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
              open && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] min-w-[180px] p-0 shadow-md"
      >
        {/* Search input */}
        <div className="border-b px-2 py-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-sm bg-transparent py-1 pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        {/* Options list */}
        <div className="max-h-48 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No results</p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                  opt.value === value && "bg-accent/60 font-medium"
                )}
              >
                <Check
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-primary",
                    opt.value !== value && "invisible"
                  )}
                />
                <span className="truncate">{opt.label}</span>
                {opt.subLabel && (
                  <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                    {opt.subLabel}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store Multi-Select — staged locally, only commits on Apply              */
/* ────────────────────────────────────────────────────────────────────────── */

interface StoreMultiSelectProps {
  /** The committed/applied selection — what the page is currently fetching for. */
  value: string[];
  options: OverviewStore[];
  /** Called only when the user clicks Apply. Triggers the actual fetch. */
  onApply: (value: string[]) => void;
  disabled?: boolean;
}

function StoreMultiSelect({ value, options, onApply, disabled }: StoreMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Draft = what the user is checking/unchecking; not committed until Apply.
  const [draft, setDraft] = useState<string[]>(value);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setSearch("");
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = search.trim()
    ? options.filter((s) => {
        const id = s.storeId ?? s.id;
        const label = s.storeId ?? s.name ?? s.id;
        return (
          label.toLowerCase().includes(search.toLowerCase()) ||
          id.toLowerCase().includes(search.toLowerCase())
        );
      })
    : options;

  const allSelected = options.length > 0 && draft.length === options.length;

  function toggleStore(id: string) {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    setDraft(allSelected ? [] : options.map((s) => s.storeId ?? s.id));
  }

  function handleApply() {
    if (draft.length === 0) return; // must keep at least one store selected
    onApply(draft);
    setOpen(false);
  }

  // Trigger label always reflects the committed `value`, not the draft.
  const label =
    options.length > 0 && value.length === options.length
      ? "All Stores"
      : value.length === 1
      ? (() => {
          const s = options.find((s) => (s.storeId ?? s.id) === value[0]);
          return s ? (s.storeId ?? s.name ?? s.id) : value[0];
        })()
      : `${value.length} stores`;

  const hasPending = draft.length !== value.length || draft.some((id) => !value.includes(id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            value.length < options.length && "border-primary/40 bg-primary/5"
          )}
        >
          <Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-start">{label}</span>
          <ChevronDown
            className={cn(
              "ms-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
              open && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0 shadow-md"
      >
        <div className="border-b px-2 py-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stores…"
              className="w-full rounded-sm bg-transparent py-1 pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {options.length > 0 && (
          <>
            <button
              type="button"
              onClick={toggleAll}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
                  allSelected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                )}
              >
                {allSelected && <Check className="h-3 w-3" />}
              </span>
              {allSelected ? "Deselect all" : "Select all"}
            </button>
            <div className="border-b" />
          </>
        )}

        <div className="max-h-52 overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No results</p>
          ) : (
            filtered.map((s) => {
              const id = s.storeId ?? s.id;
              const storeLabel = s.storeId ?? s.name ?? s.id;
              const checked = draft.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleStore(id)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{storeLabel}</span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t p-1.5">
          <Button size="sm" className="h-8 w-full" onClick={handleApply} disabled={draft.length === 0}>
            {hasPending ? `Apply (${draft.length})` : "Apply"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Filters bar                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

interface TicketsFiltersBarProps {
  filters: TicketsFilters;
  onFiltersChange: (filters: TicketsFilters) => void;
  onCreateClick: () => void;
  onCatalogClick: () => void;
  canAccessCatalog?: boolean;
  storeId?: string;
  disabled?: boolean;
  stores?: OverviewStore[];
  selectedStoreIds?: string[];
  onStoreApply?: (selection: string[]) => void;
}

export function TicketsFiltersBar({
  filters,
  onFiltersChange,
  onCreateClick,
  onCatalogClick,
  canAccessCatalog = true,
  storeId,
  disabled,
  stores,
  selectedStoreIds,
  onStoreApply,
}: TicketsFiltersBarProps) {
  const t = useTranslations("maintenanceTickets");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [catalogIssues, setCatalogIssues] = useState<CatalogIssue[]>([]);
  const [catalogTechnicians, setCatalogTechnicians] = useState<CatalogTechnician[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    if (!advancedOpen || catalogIssues.length > 0 || catalogTechnicians.length > 0) return;
    const ctrl = new AbortController();
    setCatalogLoading(true);
    Promise.all([
      maintenanceTicketsService.getCatalogIssues(ctrl.signal, storeId),
      maintenanceTicketsService.getCatalogTechnicians(ctrl.signal),
    ])
      .then(([issues, techs]) => {
        setCatalogIssues(issues.filter((i) => !i.deletedAt));
        setCatalogTechnicians(techs.filter((t) => !t.deletedAt));
      })
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
    return () => ctrl.abort();
  }, [advancedOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateField<K extends keyof TicketsFilters>(key: K, value: TicketsFilters[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  const activeFilterCount = [
    filters.statuses?.length,
    filters.priorities?.length,
    filters.issue_ids?.length,
    filters.issue_statuses?.length,
    filters.technician_ids?.length,
    filters.types?.length,
    filters.part_cost_total_gt,
    filters.trashed,
    filters.per_page,
  ].filter((v) => v != null && v !== 0).length;

  const hasAnyFilter = activeFilterCount > 0;

  const activeStoresList = (stores ?? []).filter((s) => s.isActive);

  /* ── Option lists ──────────────────────────────────────────────────────── */

  const ticketStatusOptions: SearchableSelectOption[] = [
    { value: "all", label: "All statuses" },
    { value: "pending", label: "Pending" },
    { value: "assigned", label: "Assigned" },
    { value: "in_progress", label: "In Progress" },
    { value: "complete", label: "Complete" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const priorityOptions: SearchableSelectOption[] = [
    { value: "all", label: "All priorities" },
    { value: "urgent", label: "Urgent" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  const issueOptions: SearchableSelectOption[] = [
    { value: "all", label: "All issues" },
    ...catalogIssues.map((i) => ({ value: String(i.id), label: i.title })),
  ];

  const issueStatusOptions: SearchableSelectOption[] = [
    { value: "all", label: "All statuses" },
    { value: "pending", label: "Pending" },
    { value: "assigned", label: "Assigned" },
    { value: "in_progress", label: "In Progress" },
    { value: "complete", label: "Complete" },
    { value: "deferred", label: "Deferred" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const technicianOptions: SearchableSelectOption[] = [
    { value: "all", label: "All technicians" },
    ...catalogTechnicians.map((tech) => ({
      value: String(tech.id),
      label: tech.name,
      subLabel: tech.categoryName ?? undefined,
    })),
  ];

  const typeOptions: SearchableSelectOption[] = [
    { value: "all", label: "All types" },
    { value: "normal", label: "Normal" },
    { value: "preventive_maintenance", label: "Preventive Maintenance" },
  ];

  const trashedOptions: SearchableSelectOption[] = [
    { value: "none", label: "Active only" },
    { value: "with", label: "Include deleted" },
    { value: "only", label: "Deleted only" },
  ];

  const perPageOptions: SearchableSelectOption[] = [
    { value: "default", label: "Default" },
    { value: "5", label: "5" },
    { value: "10", label: "10" },
    { value: "15", label: "15" },
    { value: "20", label: "20" },
    { value: "25", label: "25" },
  ];

  return (
    <div className="space-y-2">
      {/* ── Main toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Store selector — multi-select, staged locally, committed via Apply */}
        {stores && stores.length > 0 && onStoreApply && (
          <div className="w-48">
            <StoreMultiSelect
              value={selectedStoreIds ?? []}
              options={activeStoresList}
              onApply={onStoreApply}
              disabled={disabled}
            />
          </div>
        )}

        {/* Filters toggle */}
        <Button
          variant={advancedOpen ? "secondary" : "outline"}
          size="sm"
          onClick={() => setAdvancedOpen((v) => !v)}
          disabled={disabled}
          className={cn(
            "h-9 gap-1.5",
            activeFilterCount > 0 && !advancedOpen && "border-primary/40 bg-primary/5 text-primary"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filters</span>
          {activeFilterCount > 0 ? (
            <Badge variant="default" className="h-4 min-w-4 px-1 text-[10px] leading-none">
              {activeFilterCount}
            </Badge>
          ) : (
            <ChevronDown
              className={cn("h-3 w-3 transition-transform duration-200", advancedOpen && "rotate-180")}
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
        <div className="ms-auto flex items-center gap-2">
          {canAccessCatalog && (
            <Button variant="outline" size="sm" onClick={onCatalogClick} disabled={disabled} className="h-9 gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("filters.catalog")}</span>
            </Button>
          )}
          <Button size="sm" onClick={onCreateClick} disabled={disabled} className="h-9 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("filters.createTicket")}</span>
          </Button>
        </div>
      </div>

      {/* ── Filters panel ────────────────────────────────────────────── */}
      {advancedOpen && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Filters
              </span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {activeFilterCount} active
                </Badge>
              )}
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                onClick={() => onFiltersChange({})}
              >
                <X className="me-1 h-3 w-3" />
                Clear all
              </Button>
            )}
          </div>

          {/* Filter fields grid */}
          <div className="grid gap-x-4 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* Ticket Status */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CircleDot className="h-3 w-3" />
                Ticket Status
              </label>
              <SearchableSelect
                value={filters.statuses?.[0] || "all"}
                options={ticketStatusOptions}
                onChange={(v) => updateField("statuses", v === "all" ? [] : [v as TicketStatus])}
                disabled={disabled}
                active={!!filters.statuses?.length}
                searchPlaceholder="Search statuses…"
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Flag className="h-3 w-3" />
                Priority
              </label>
              <SearchableSelect
                value={filters.priorities?.[0] || "all"}
                options={priorityOptions}
                onChange={(v) => updateField("priorities", v === "all" ? [] : [v as Priority])}
                disabled={disabled}
                active={!!filters.priorities?.length}
                searchPlaceholder="Search priorities…"
              />
            </div>

            {/* Issue */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <AlertCircle className="h-3 w-3" />
                Issue
              </label>
              <SearchableSelect
                value={filters.issue_ids?.[0] != null ? String(filters.issue_ids[0]) : "all"}
                options={catalogLoading ? [{ value: "all", label: "Loading…" }] : issueOptions}
                onChange={(v) => updateField("issue_ids", v === "all" ? [] : [Number(v)])}
                disabled={disabled || catalogLoading}
                active={!!filters.issue_ids?.length}
                placeholder={catalogLoading ? "Loading…" : "All issues"}
                searchPlaceholder="Search issues…"
              />
            </div>

            {/* Issue Status */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/50" />
                Issue Status
              </label>
              <SearchableSelect
                value={filters.issue_statuses?.[0] || "all"}
                options={issueStatusOptions}
                onChange={(v) => updateField("issue_statuses", v === "all" ? [] : [v as IssueStatus])}
                disabled={disabled}
                active={!!filters.issue_statuses?.length}
                searchPlaceholder="Search statuses…"
              />
            </div>

            {/* Technician */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <User className="h-3 w-3" />
                Technician
              </label>
              <SearchableSelect
                value={filters.technician_ids?.[0] != null ? String(filters.technician_ids[0]) : "all"}
                options={catalogLoading ? [{ value: "all", label: "Loading…" }] : technicianOptions}
                onChange={(v) => updateField("technician_ids", v === "all" ? [] : [Number(v)])}
                disabled={disabled || catalogLoading}
                active={!!filters.technician_ids?.length}
                placeholder={catalogLoading ? "Loading…" : "All technicians"}
                searchPlaceholder="Search technicians…"
              />
            </div>

            {/* Ticket Type */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <List className="h-3 w-3" />
                Ticket Type
              </label>
              <SearchableSelect
                value={filters.types?.[0] || "all"}
                options={typeOptions}
                onChange={(v) => updateField("types", v === "all" ? [] : [v as TicketType])}
                disabled={disabled}
                active={!!filters.types?.length}
                searchPlaceholder="Search types…"
              />
            </div>

            {/* Min part cost */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                Min part cost
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-xs text-muted-foreground">$</span>
                <Input
                  placeholder="0.00"
                  value={filters.part_cost_total_gt ?? ""}
                  onChange={(e) => updateField("part_cost_total_gt", e.target.value ? Number(e.target.value) : undefined)}
                  disabled={disabled}
                  type="number"
                  min="0"
                  step="0.01"
                  className={cn(
                    "h-9 ps-6 text-sm",
                    filters.part_cost_total_gt != null && "border-primary/40 bg-primary/5"
                  )}
                />
              </div>
            </div>

            {/* Deleted records */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Trash2 className="h-3 w-3" />
                Deleted records
              </label>
              <SearchableSelect
                value={filters.trashed || "none"}
                options={trashedOptions}
                onChange={(v) => updateField("trashed", v === "none" ? undefined : (v as TicketsFilters["trashed"]))}
                disabled={disabled}
                active={!!filters.trashed}
                searchPlaceholder="Search…"
              />
            </div>

            {/* Results per page */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <List className="h-3 w-3" />
                Results per page
              </label>
              <SearchableSelect
                value={filters.per_page != null ? String(filters.per_page) : "default"}
                options={perPageOptions}
                onChange={(v) => updateField("per_page", v === "default" ? undefined : Number(v))}
                disabled={disabled}
                active={filters.per_page != null}
                searchPlaceholder="Search…"
              />
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
