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
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { Plus, BookOpen, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import type { CatalogIssue, CatalogTechnician, TicketsFilters } from "@/types/maintenance-tickets.types";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";
import { cn } from "@/lib/utils";

interface TicketsFiltersBarProps {
  filters: TicketsFilters;
  onFiltersChange: (filters: TicketsFilters) => void;
  onCreateClick: () => void;
  onCatalogClick: () => void;
  disabled?: boolean;
}

export function TicketsFiltersBar({
  filters,
  onFiltersChange,
  onCreateClick,
  onCatalogClick,
  disabled,
}: TicketsFiltersBarProps) {
  const t = useTranslations("maintenanceTickets");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [catalogIssues, setCatalogIssues] = useState<CatalogIssue[]>([]);
  const [catalogTechnicians, setCatalogTechnicians] = useState<CatalogTechnician[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Load catalog data when advanced panel opens for the first time
  useEffect(() => {
    if (!advancedOpen || catalogIssues.length > 0 || catalogTechnicians.length > 0) return;
    const ctrl = new AbortController();
    setCatalogLoading(true);
    Promise.all([
      maintenanceTicketsService.getCatalogIssues(ctrl.signal),
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

  const activeAdvancedCount = [
    filters.issue_id,
    filters.issue_status,
    filters.part_cost_total_gt,
    filters.technician_id,
    filters.trashed,
    filters.per_page,
  ].filter((v) => v != null && v !== "").length;

  function clearAllFilters() {
    onFiltersChange({});
  }

  const hasAnyFilter =
    filters.status ||
    filters.priority ||
    activeAdvancedCount > 0;

  return (
    <div className="space-y-2">
      {/* Primary toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status */}
        <Select
          value={filters.status || "all"}
          onValueChange={(v) => updateField("status", v === "all" ? "" : (v as TicketsFilters["status"]))}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue placeholder={t("filters.statusPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
            <SelectItem value="pending">{t("status.pending")}</SelectItem>
            <SelectItem value="assigned">{t("status.assigned")}</SelectItem>
            <SelectItem value="in_progress">{t("status.in_progress")}</SelectItem>
            <SelectItem value="complete">{t("status.complete")}</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {/* Priority */}
        <Select
          value={filters.priority || "all"}
          onValueChange={(v) => updateField("priority", v === "all" ? "" : (v as TicketsFilters["priority"]))}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue placeholder={t("filters.priorityPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allPriorities")}</SelectItem>
            <SelectItem value="urgent">{t("priority.urgent")}</SelectItem>
            <SelectItem value="high">{t("priority.high")}</SelectItem>
            <SelectItem value="medium">{t("priority.medium")}</SelectItem>
            <SelectItem value="low">{t("priority.low")}</SelectItem>
          </SelectContent>
        </Select>

        {/* Advanced toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdvancedOpen((v) => !v)}
          disabled={disabled}
          className={cn(activeAdvancedCount > 0 && "border-primary/50 text-primary")}
        >
          <SlidersHorizontal className="me-1.5 h-4 w-4" />
          Filters
          {activeAdvancedCount > 0 && (
            <span className="ms-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {activeAdvancedCount}
            </span>
          )}
          <ChevronDown className={cn("ms-1 h-3 w-3 transition-transform", advancedOpen && "rotate-180")} />
        </Button>

        {/* Clear all */}
        {hasAnyFilter && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} disabled={disabled} className="text-muted-foreground h-9 px-2">
            <X className="me-1 h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        <div className="ms-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCatalogClick} disabled={disabled}>
            <BookOpen className="me-1.5 h-4 w-4" />
            <span className="hidden sm:inline">{t("filters.catalog")}</span>
          </Button>
          <Button size="sm" onClick={onCreateClick} disabled={disabled}>
            <Plus className="me-1.5 h-4 w-4" />
            <span className="hidden sm:inline">{t("filters.createTicket")}</span>
          </Button>
        </div>
      </div>

      {/* Advanced panel */}
      {advancedOpen && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Advanced Filters</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {/* Issue (catalog-driven) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Issue</Label>
              <Select
                value={filters.issue_id != null ? String(filters.issue_id) : "all"}
                onValueChange={(v) => updateField("issue_id", v === "all" ? undefined : Number(v))}
                disabled={disabled || catalogLoading}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={catalogLoading ? "Loading…" : "All issues"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All issues</SelectItem>
                  {catalogIssues.map((issue) => (
                    <SelectItem key={issue.id} value={String(issue.id)}>
                      {issue.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Issue status */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Issue status</Label>
              <Select
                value={filters.issue_status || "all"}
                onValueChange={(v) => updateField("issue_status", v === "all" ? "" : (v as TicketsFilters["issue_status"]))}
                disabled={disabled}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
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

            {/* Technician (catalog-driven) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Technician</Label>
              <Select
                value={filters.technician_id != null ? String(filters.technician_id) : "all"}
                onValueChange={(v) => updateField("technician_id", v === "all" ? undefined : Number(v))}
                disabled={disabled || catalogLoading}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={catalogLoading ? "Loading…" : "All technicians"} />
                </SelectTrigger>
                <SelectContent>
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

            {/* Min total part cost */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Min total part cost ($)</Label>
              <Input
                placeholder="e.g. 100"
                value={filters.part_cost_total_gt ?? ""}
                onChange={(e) => updateField("part_cost_total_gt", e.target.value ? Number(e.target.value) : undefined)}
                disabled={disabled}
                type="number"
                min="0"
                step="0.01"
                className="h-9 text-sm"
              />
            </div>

            {/* Trashed */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Deleted records</Label>
              <Select
                value={filters.trashed || "none"}
                onValueChange={(v) => updateField("trashed", v === "none" ? undefined : (v as TicketsFilters["trashed"]))}
                disabled={disabled}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Active only</SelectItem>
                  <SelectItem value="with">Include deleted</SelectItem>
                  <SelectItem value="only">Deleted only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Per page */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Results per page</Label>
              <Select
                value={filters.per_page != null ? String(filters.per_page) : "default"}
                onValueChange={(v) => updateField("per_page", v === "default" ? undefined : Number(v))}
                disabled={disabled}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Default" /></SelectTrigger>
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

          {/* Clear advanced */}
          {activeAdvancedCount > 0 && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7 px-2"
                onClick={() => onFiltersChange({ status: filters.status, priority: filters.priority })}
              >
                <X className="me-1 h-3 w-3" />
                Clear advanced filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

