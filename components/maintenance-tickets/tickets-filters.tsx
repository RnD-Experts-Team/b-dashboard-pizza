"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import type { CatalogIssue, CatalogTechnician, TicketsFilters } from "@/types/maintenance-tickets.types";
import type { OverviewStore } from "@/lib/api/services/auth.service";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";
import { cn } from "@/lib/utils";

interface TicketsFiltersBarProps {
  filters: TicketsFilters;
  onFiltersChange: (filters: TicketsFilters) => void;
  onCreateClick: () => void;
  onCatalogClick: () => void;
  canAccessCatalog?: boolean;
  storeId?: string;
  disabled?: boolean;
  stores?: OverviewStore[];
  selectedStoreId?: string | "all";
  onStoreChange?: (storeId: string | "all") => void;
  canAccessAllStores?: boolean;
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
  selectedStoreId,
  onStoreChange,
  canAccessAllStores,
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

  // Count all active filters (including status + priority now inside panel)
  const activeFilterCount = [
    filters.status,
    filters.priority,
    filters.issue_id,
    filters.issue_status,
    filters.part_cost_total_gt,
    filters.technician_id,
    filters.trashed,
    filters.per_page,
  ].filter((v) => v != null && v !== "").length;

  const hasAnyFilter = activeFilterCount > 0;

  const selectedStoreName = (() => {
    if (!stores || !selectedStoreId || selectedStoreId === "all") return null;
    const s = stores.find((s) => (s.storeId ?? s.id) === selectedStoreId);
    return s ? (s.storeId ?? s.name ?? s.id) : null;
  })();

  return (
    <div className="space-y-2">
      {/* ── Main toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Store selector — always visible, outside filters */}
        {stores && stores.length > 0 && onStoreChange && (
          <Select
            value={selectedStoreId ?? "all"}
            onValueChange={(v) => onStoreChange(v as string | "all")}
            disabled={disabled}
          >
            <SelectTrigger
              className={cn(
                "h-9 w-44 gap-1.5 text-sm",
                selectedStoreName && "border-primary/40 bg-primary/5 text-primary font-medium"
              )}
            >
              <Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder={t("filters.allStores")} />
            </SelectTrigger>
            <SelectContent
              position="popper"
              style={{ maxHeight: "200px", overflowY: "auto" }}
            >
              {canAccessAllStores && (
                <SelectItem value="all">{t("filters.allStores")}</SelectItem>
              )}
              {stores.filter((s) => s.isActive).map((store) => (
                <SelectItem key={store.id} value={store.storeId ?? store.id}>
                  {store.storeId ?? store.name ?? store.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <Select
                value={filters.status || "all"}
                onValueChange={(v) => updateField("status", v === "all" ? "" : (v as TicketsFilters["status"]))}
                disabled={disabled}
              >
                <SelectTrigger className={cn("h-9 text-sm", filters.status && "border-primary/40 bg-primary/5")}>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Flag className="h-3 w-3" />
                Priority
              </label>
              <Select
                value={filters.priority || "all"}
                onValueChange={(v) => updateField("priority", v === "all" ? "" : (v as TicketsFilters["priority"]))}
                disabled={disabled}
              >
                <SelectTrigger className={cn("h-9 text-sm", filters.priority && "border-primary/40 bg-primary/5")}>
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Issue */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <AlertCircle className="h-3 w-3" />
                Issue
              </label>
              <Select
                value={filters.issue_id != null ? String(filters.issue_id) : "all"}
                onValueChange={(v) => updateField("issue_id", v === "all" ? undefined : Number(v))}
                disabled={disabled || catalogLoading}
              >
                <SelectTrigger className={cn("h-9 text-sm", filters.issue_id != null && "border-primary/40 bg-primary/5")}>
                  <SelectValue placeholder={catalogLoading ? "Loading…" : "All issues"} />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  style={{ maxHeight: "200px", overflowY: "auto" }}
                >
                  <SelectItem value="all">All issues</SelectItem>
                  {catalogIssues.map((issue) => (
                    <SelectItem key={issue.id} value={String(issue.id)}>
                      {issue.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Issue Status */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/50" />
                Issue Status
              </label>
              <Select
                value={filters.issue_status || "all"}
                onValueChange={(v) => updateField("issue_status", v === "all" ? "" : (v as TicketsFilters["issue_status"]))}
                disabled={disabled}
              >
                <SelectTrigger className={cn("h-9 text-sm", filters.issue_status && "border-primary/40 bg-primary/5")}>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="deferred">Deferred</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Technician */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <User className="h-3 w-3" />
                Technician
              </label>
              <Select
                value={filters.technician_id != null ? String(filters.technician_id) : "all"}
                onValueChange={(v) => updateField("technician_id", v === "all" ? undefined : Number(v))}
                disabled={disabled || catalogLoading}
              >
                <SelectTrigger className={cn("h-9 text-sm", filters.technician_id != null && "border-primary/40 bg-primary/5")}>
                  <SelectValue placeholder={catalogLoading ? "Loading…" : "All technicians"} />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  style={{ maxHeight: "200px", overflowY: "auto" }}
                >
                  <SelectItem value="all">All technicians</SelectItem>
                  {catalogTechnicians.map((tech) => (
                    <SelectItem key={tech.id} value={String(tech.id)}>
                      {tech.name}
                      {tech.categoryName && (
                        <span className="ms-1.5 text-muted-foreground text-xs">· {tech.categoryName}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select
                value={filters.trashed || "none"}
                onValueChange={(v) => updateField("trashed", v === "none" ? undefined : (v as TicketsFilters["trashed"]))}
                disabled={disabled}
              >
                <SelectTrigger className={cn("h-9 text-sm", filters.trashed && "border-primary/40 bg-primary/5")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Active only</SelectItem>
                  <SelectItem value="with">Include deleted</SelectItem>
                  <SelectItem value="only">Deleted only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results per page */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <List className="h-3 w-3" />
                Results per page
              </label>
              <Select
                value={filters.per_page != null ? String(filters.per_page) : "default"}
                onValueChange={(v) => updateField("per_page", v === "default" ? undefined : Number(v))}
                disabled={disabled}
              >
                <SelectTrigger className={cn("h-9 text-sm", filters.per_page != null && "border-primary/40 bg-primary/5")}>
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
