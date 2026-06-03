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
import { useState } from "react";
import { Download, Plus, BookOpen, SlidersHorizontal } from "lucide-react";
import type { TicketsFilters } from "@/types/maintenance-tickets.types";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";

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
  const [isExporting, setIsExporting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try { await maintenanceTicketsService.downloadExport(); }
    finally { setIsExporting(false); }
  }

  function handleStatus(value: string) {
    onFiltersChange({ ...filters, status: value === "all" ? "" : (value as TicketsFilters["status"]) });
  }

  function handlePriority(value: string) {
    onFiltersChange({ ...filters, priority: value === "all" ? "" : (value as TicketsFilters["priority"]) });
  }

  function updateField<K extends keyof TicketsFilters>(key: K, value: TicketsFilters[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status filter */}
      <Select
        value={filters.status || "all"}
        onValueChange={handleStatus}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 w-40 text-sm">
          <SelectValue placeholder={t("filters.statusPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
          <SelectItem value="pending">{t("status.pending")}</SelectItem>
          <SelectItem value="assigned">{t("status.assigned")}</SelectItem>
          <SelectItem value="in_progress">{t("status.in_progress")}</SelectItem>
          <SelectItem value="complete">{t("status.complete")}</SelectItem>
        </SelectContent>
      </Select>

      {/* Priority filter */}
      <Select
        value={filters.priority || "all"}
        onValueChange={handlePriority}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 w-40 text-sm">
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

      <div className="ms-auto flex items-center gap-2">
        {/* Export */}
        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting || disabled}>
          {isExporting
            ? <span className="me-1.5 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            : <Download className="me-1.5 h-4 w-4" />}
          {t("filters.export") || "Export"}
        </Button>

        <Button variant="outline" size="sm" onClick={() => setAdvancedOpen((v) => !v)} disabled={disabled}>
          <SlidersHorizontal className="me-1.5 h-4 w-4" />
          {advancedOpen ? "Hide Advanced" : "Advanced"}
        </Button>

        {/* Catalog */}
        <Button variant="outline" size="sm" onClick={onCatalogClick} disabled={disabled}>
          <BookOpen className="me-1.5 h-4 w-4" />
          {t("filters.catalog")}
        </Button>

        {/* Create */}
        <Button size="sm" onClick={onCreateClick} disabled={disabled}>
          <Plus className="me-1.5 h-4 w-4" />
          {t("filters.createTicket")}
        </Button>
      </div>

      {advancedOpen && (
        <div className="w-full rounded-lg border bg-muted/20 p-3 mt-1">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Issue ID"
              value={filters.issue_id ?? ""}
              onChange={(e) => updateField("issue_id", e.target.value ? Number(e.target.value) : undefined)}
              disabled={disabled}
              type="number"
              className="h-9"
            />
            <Select
              value={filters.issue_status || "all"}
              onValueChange={(value) => updateField("issue_status", value === "all" ? "" : (value as TicketsFilters["issue_status"]))}
              disabled={disabled}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Issue status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All issue statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="deferred">Deferred</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Assigned from"
              value={filters.assigned_from ?? ""}
              onChange={(e) => updateField("assigned_from", e.target.value || undefined)}
              disabled={disabled}
              type="date"
              className="h-9"
            />
            <Input
              placeholder="Assigned to"
              value={filters.assigned_to ?? ""}
              onChange={(e) => updateField("assigned_to", e.target.value || undefined)}
              disabled={disabled}
              type="date"
              className="h-9"
            />
            <Input
              placeholder="Min single part cost"
              value={filters.part_cost_single_gt ?? ""}
              onChange={(e) => updateField("part_cost_single_gt", e.target.value ? Number(e.target.value) : undefined)}
              disabled={disabled}
              type="number"
              className="h-9"
            />
            <Input
              placeholder="Min total part cost"
              value={filters.part_cost_total_gt ?? ""}
              onChange={(e) => updateField("part_cost_total_gt", e.target.value ? Number(e.target.value) : undefined)}
              disabled={disabled}
              type="number"
              className="h-9"
            />
            <Input
              placeholder="Technician ID"
              value={filters.technician_id ?? ""}
              onChange={(e) => updateField("technician_id", e.target.value ? Number(e.target.value) : undefined)}
              disabled={disabled}
              type="number"
              className="h-9"
            />
            <Input
              placeholder="Creator ID"
              value={filters.creator_id ?? ""}
              onChange={(e) => updateField("creator_id", e.target.value ? Number(e.target.value) : undefined)}
              disabled={disabled}
              type="number"
              className="h-9"
            />
            <Select
              value={filters.trashed || "none"}
              onValueChange={(value) => updateField("trashed", value === "none" ? undefined : (value as TicketsFilters["trashed"]))}
              disabled={disabled}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Trash mode" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Default</SelectItem>
                <SelectItem value="with">With trashed</SelectItem>
                <SelectItem value="only">Only trashed</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Sort field"
              value={filters.sort ?? ""}
              onChange={(e) => updateField("sort", e.target.value || undefined)}
              disabled={disabled}
              className="h-9"
            />
            <Select
              value={filters.dir || "desc"}
              onValueChange={(value) => updateField("dir", value as TicketsFilters["dir"])}
              disabled={disabled}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Direction" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Asc</SelectItem>
                <SelectItem value="desc">Desc</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
