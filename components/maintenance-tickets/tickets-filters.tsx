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
import { useState } from "react";
import { Download, Plus, BookOpen } from "lucide-react";
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
        {/* <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting || disabled}>
          {isExporting
            ? <span className="me-1.5 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            : <Download className="me-1.5 h-4 w-4" />}
          {t("filters.export")}
        </Button> */}

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
    </div>
  );
}
