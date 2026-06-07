"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar as CalendarComp } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  ClockIcon,
  Loader2,
  RefreshCw,
  Search,
  StickyNote,
  User,
  Users2,
  AlertCircle,
  CheckCircle2,
  Circle,
  Hash,
  Store,
  ClipboardList,
  FileText,
  ShieldCheck,
  TimerReset,
  Wrench,
  Package,
  Wallet,
  UserRoundPlus,
  MoreHorizontal,
  Paperclip,
  ListChecks,
  LayoutList,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
  entityPaths,
} from "@/lib/api/services/maintenance-tickets.service";
import type {
  Ticket,
  TicketIssue,
  TicketIssuesResponse,
  IssueStatus,
  CatalogTechnician,
  CatalogPart,
  TicketsFilters,
  TicketNote,
  TicketAttachment,
  NoteType,
} from "@/types/maintenance-tickets.types";
import { EntityNotesAttachments } from "./entity-extras";
import { NotesList } from "./notes-list";
import { SearchCreateCombobox } from "./search-create-combobox";
import {
  useTicketDraft,
  EMPTY_ISSUE_DRAFT,
  type IssueDraft,
} from "@/lib/hooks/use-ticket-draft";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string) {
  try {
    // Date-only strings (YYYY-MM-DD) must be parsed in local time — `new Date("YYYY-MM-DD")` parses
    // as UTC midnight which shifts the displayed date one day back in UTC-offset timezones.
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso.trim()) ? new Date(iso + "T00:00") : new Date(iso);
    return format(d, "MMM d, yyyy");
  } catch { return iso; }
}

function fmtDateTime(iso: string) {
  try { return format(new Date(iso), "MMM d, yyyy HH:mm"); } catch { return iso; }
}

function calcDuration(startIso: string, endIso: string): string | null {
  try {
    const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
    if (!Number.isFinite(diff) || diff <= 0) return null;
    const totalMins = Math.floor(diff / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  } catch { return null; }
}

/** Shadcn date picker — Calendar in a Popover */
function DatePicker({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value + "T00:00") : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-8 w-full justify-start text-left text-sm font-normal gap-2", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {value ? format(new Date(value + "T00:00"), "MMM d, yyyy") : <span>{placeholder ?? "Pick a date"}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComp
          mode="single"
          selected={selected}
          onSelect={(d) => { if (d) { onChange(format(d, "yyyy-MM-dd")); setOpen(false); } }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/** Shadcn time picker — Popover with time Input */
function TimePicker({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-8 w-full justify-start text-left text-sm font-normal gap-2", !value && "text-muted-foreground", className)}
        >
          <ClockIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {value || <span>{placeholder ?? "Pick a time"}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-3 space-y-2" align="start">
        <p className="text-xs font-medium text-muted-foreground">Select time</p>
        <Input
          type="time"
          className="h-8 text-sm [color-scheme:light] dark:[color-scheme:dark]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
        <Button size="sm" className="w-full h-7 text-xs" onClick={() => setOpen(false)}>Done</Button>
      </PopoverContent>
    </Popover>
  );
}

/** Shadcn datetime picker — Calendar + time Input in a Popover */
function DateTimePicker({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const datePart = value ? value.slice(0, 10) : "";
  const timePart = value ? value.slice(11, 16) : "";
  const selected = datePart ? new Date(datePart + "T00:00") : undefined;

  function handleDateSelect(d: Date | undefined) {
    if (!d) return;
    onChange(`${format(d, "yyyy-MM-dd")}T${timePart || "00:00"}`);
  }
  function handleTimeChange(t: string) {
    onChange(`${datePart || format(new Date(), "yyyy-MM-dd")}T${t}`);
  }

  const displayValue = datePart
    ? `${format(new Date(datePart + "T00:00"), "MMM d, yyyy")}${timePart ? ` ${timePart}` : ""}`
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-8 w-full justify-start text-left text-sm font-normal gap-2", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {displayValue || <span>{placeholder ?? "Pick date & time"}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComp
          mode="single"
          selected={selected}
          onSelect={handleDateSelect}
          autoFocus
        />
        <div className="border-t p-3 space-y-2">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              type="time"
              className="h-8 flex-1 text-sm [color-scheme:light] dark:[color-scheme:dark]"
              value={timePart}
              onChange={(e) => handleTimeChange(e.target.value)}
            />
          </div>
          <Button size="sm" className="w-full h-7 text-xs" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Minimal chips (no color variants)                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function StatusChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-foreground bg-background">
      {label}
    </span>
  );
}

function PriorityChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Right navigator                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

interface NavigatorProps {
  tickets: Ticket[];
  activeId: number | null;
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (id: number) => void;
  filters?: TicketsFilters;
  onFiltersChange?: (f: TicketsFilters) => void;
  technicians?: CatalogTechnician[];
}

function TicketNavigator({ tickets, activeId, search, onSearchChange, onSelect, filters, onFiltersChange, technicians }: NavigatorProps) {
  const t = useTranslations("maintenanceTickets");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  // Clear filtering skeleton once new tickets arrive
  useEffect(() => {
    setIsFiltering(false);
  }, [tickets]);

  const filtered = search.trim()
    ? tickets.filter(
        (tk) =>
          String(tk.id).includes(search.trim()) ||
          tk.storeId.toLowerCase().includes(search.trim().toLowerCase())
      )
    : tickets;

  const activeFilterCount = [
    filters?.status,
    filters?.priority,
    filters?.issue_status,
    filters?.technician_id,
  ].filter((v) => v != null && v !== "").length;

  const hasAnyFilter = activeFilterCount > 0;

  function updateFilter<K extends keyof TicketsFilters>(key: K, value: TicketsFilters[K]) {
    setIsFiltering(true);
    onFiltersChange?.({ ...(filters ?? {}), [key]: value });
  }

  function clearFilters() {
    setIsFiltering(true);
    onFiltersChange?.({});
  }

  return (
    <aside className="hidden md:flex w-72 flex-col border-s bg-background/95 shrink-0 overflow-hidden">
      <div className="px-3 py-3 border-b shrink-0 space-y-2.5 bg-muted/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
          {t("navigator.title")}
        </p>
        {/* Search */}
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("navigator.searchPlaceholder")}
            className="h-7 ps-7 text-[11px]"
          />
        </div>

        {/* Filter toggle row */}
        {onFiltersChange && (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  "flex min-w-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  filtersOpen || hasAnyFilter
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-border bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <SlidersHorizontal className="h-3 w-3 shrink-0" />
                <span className="truncate">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", filtersOpen && "rotate-180")} />
              </button>
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>

            {/* Filter panel — 2-col grid */}
            {filtersOpen && (
              <div className="rounded-md border bg-background p-2 grid grid-cols-2 gap-x-2 gap-y-2">
                {/* Status */}
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground truncate">Status</p>
                  <Select
                    value={filters?.status || "all"}
                    onValueChange={(v) => updateFilter("status", v === "all" ? "" : (v as TicketsFilters["status"]))}
                  >
                    <SelectTrigger className="h-6 w-full min-w-0 text-[10px] px-1.5 [&>span]:truncate [&>svg]:shrink-0 [&>svg]:h-2.5 [&>svg]:w-2.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-[11px] min-w-[100px] max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
                      <SelectItem value="all" className="text-[11px] py-1 px-2">All</SelectItem>
                      <SelectItem value="pending" className="text-[11px] py-1 px-2">{t("status.pending")}</SelectItem>
                      <SelectItem value="assigned" className="text-[11px] py-1 px-2">{t("status.assigned")}</SelectItem>
                      <SelectItem value="in_progress" className="text-[11px] py-1 px-2">{t("status.in_progress")}</SelectItem>
                      <SelectItem value="complete" className="text-[11px] py-1 px-2">{t("status.complete")}</SelectItem>
                      <SelectItem value="cancelled" className="text-[11px] py-1 px-2">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground truncate">Priority</p>
                  <Select
                    value={filters?.priority || "all"}
                    onValueChange={(v) => updateFilter("priority", v === "all" ? "" : (v as TicketsFilters["priority"]))}
                  >
                    <SelectTrigger className="h-6 w-full min-w-0 text-[10px] px-1.5 [&>span]:truncate [&>svg]:shrink-0 [&>svg]:h-2.5 [&>svg]:w-2.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-[11px] min-w-[100px] max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
                      <SelectItem value="all" className="text-[11px] py-1 px-2">All</SelectItem>
                      <SelectItem value="urgent" className="text-[11px] py-1 px-2">{t("priority.urgent")}</SelectItem>
                      <SelectItem value="high" className="text-[11px] py-1 px-2">{t("priority.high")}</SelectItem>
                      <SelectItem value="medium" className="text-[11px] py-1 px-2">{t("priority.medium")}</SelectItem>
                      <SelectItem value="low" className="text-[11px] py-1 px-2">{t("priority.low")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Issue status */}
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground truncate">Issue status</p>
                  <Select
                    value={filters?.issue_status || "all"}
                    onValueChange={(v) => updateFilter("issue_status", v === "all" ? "" : (v as TicketsFilters["issue_status"]))}
                  >
                    <SelectTrigger className="h-6 w-full min-w-0 text-[10px] px-1.5 [&>span]:truncate [&>svg]:shrink-0 [&>svg]:h-2.5 [&>svg]:w-2.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-[11px] min-w-[100px] max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
                      <SelectItem value="all" className="text-[11px] py-1 px-2">All</SelectItem>
                      <SelectItem value="pending" className="text-[11px] py-1 px-2">Pending</SelectItem>
                      <SelectItem value="assigned" className="text-[11px] py-1 px-2">Assigned</SelectItem>
                      <SelectItem value="in_progress" className="text-[11px] py-1 px-2">In Progress</SelectItem>
                      <SelectItem value="complete" className="text-[11px] py-1 px-2">Complete</SelectItem>
                      <SelectItem value="deferred" className="text-[11px] py-1 px-2">Deferred</SelectItem>
                      <SelectItem value="cancelled" className="text-[11px] py-1 px-2">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Technician */}
                {technicians && technicians.length > 0 && (
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground truncate">Technician</p>
                    <Select
                      value={filters?.technician_id != null ? String(filters.technician_id) : "all"}
                      onValueChange={(v) => updateFilter("technician_id", v === "all" ? undefined : Number(v))}
                    >
                      <SelectTrigger className="h-6 w-full min-w-0 text-[10px] px-1.5 [&>span]:truncate [&>svg]:shrink-0 [&>svg]:h-2.5 [&>svg]:w-2.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-[11px] min-w-[100px] max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
                        <SelectItem value="all" className="text-[11px] py-1 px-2">All</SelectItem>
                        {technicians.filter((tc) => !tc.deletedAt).map((tc) => (
                          <SelectItem key={tc.id} value={String(tc.id)} className="text-[11px] py-1 px-2">
                            <span className="truncate">{tc.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Filtering skeleton */}
        {isFiltering && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-md border p-3 space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-2.5 w-12" />
              </div>
            ))}
          </div>
        )}

        {!isFiltering && filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            {t("navigator.noResults")}
          </p>
        )}
        {!isFiltering && filtered.map((ticket) => (
          <button
            key={ticket.id}
            type="button"
            onClick={() => onSelect(ticket.id)}
            className={cn(
              "relative w-full text-start px-2.5 py-2 transition-colors hover:bg-muted/40 border rounded-md mb-1.5 last:mb-0 overflow-hidden",
              ticket.id === activeId &&
                "bg-accent border-primary/40 shadow-sm before:absolute before:start-0 before:inset-y-1 before:w-0.5 before:bg-primary before:rounded-e"
            )}
          >
            <p className={cn("text-[11px] font-semibold truncate", ticket.id === activeId ? "text-foreground" : "text-muted-foreground")}>
              ID #{ticket.id}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{ticket.storeId}</p>
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              <span className="inline-flex items-center rounded-sm border px-1 py-px text-[9px] text-muted-foreground shrink-0">
                {t("navigator.issueCount", { count: ticket.issueCount })}
              </span>
              {ticket.status?.label && (
                <span className="inline-flex items-center rounded-sm border px-1 py-px text-[9px] text-muted-foreground truncate max-w-[80px]">
                  {ticket.status.label}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Inline action panels                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

interface StatusPanelProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  /** When provided, sends all these IDs instead of [issue.id] (bulk mode) */
  issueIds?: number[];
  onClose: () => void;
  onSuccess: () => void;
}

function ChangeStatusPanel({ issue, storeId, ticketId, issueIds, onClose, onSuccess }: StatusPanelProps) {
  const t = useTranslations("maintenanceTickets");
  const [status, setStatus] = useState<IssueStatus>(issue.status.value as IssueStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const effectiveIds = issueIds ?? [issue.id];
  const hasChanged = issueIds ? true : status !== (issue.status.value as IssueStatus);

  async function handleSubmit() {
    setIsSubmitting(true); setError(null);
    try {
      await maintenanceTicketsService.changeIssueStatus(storeId, ticketId, {
        ticket_issue_ids: effectiveIds, status,
      });
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : t("detailSheet.actionError"));
    } finally { setIsSubmitting(false); }
  }

  const statusOptions: { value: IssueStatus; label: string }[] = [
    { value: "pending", label: t("status.pending") },
    { value: "assigned", label: t("status.assigned") },
    { value: "in_progress", label: t("status.in_progress") },
    { value: "complete", label: t("status.complete") },
  ];

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
        <div className="flex items-center justify-center gap-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Status updated successfully</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("detailSheet.changeStatus")}</p>
      <div className="flex flex-wrap gap-1.5">
        {statusOptions.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
              status === s.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-input hover:bg-muted/50"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>{t("common.cancel")}</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !hasChanged}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

interface AssignPanelProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  technicians: CatalogTechnician[];
  issueIds?: number[];
  issueDraft: IssueDraft;
  onPatchDraft: (patch: Partial<IssueDraft>) => void;
  onClose: () => void;
  onSuccess: () => void;
}

function AssignPanel({ issue, storeId, ticketId, technicians, issueIds, issueDraft, onPatchDraft, onClose, onSuccess }: AssignPanelProps) {
  const t = useTranslations("maintenanceTickets");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const activeTechs = technicians.filter((tech) => !tech.deletedAt);

  function toggleTech(id: number) {
    const current = issueDraft.assignTechs;
    onPatchDraft({ assignTechs: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
  }

  async function handleSubmit() {
    if (!issueDraft.assignDate) { setError(t("detailSheet.assignDateRequired")); return; }
    if (issueDraft.assignTechs.length === 0) { setError(t("detailSheet.assignTechRequired")); return; }
    setIsSubmitting(true); setError(null);
    try {
      await maintenanceTicketsService.assignIssues(storeId, ticketId, {
        ticket_issue_ids: issueIds ?? [issue.id],
        technician_ids: issueDraft.assignTechs,
        assigned_date: issueDraft.assignDate,
        ...(issueDraft.assignHour && { assigned_hour: issueDraft.assignHour }),
      });
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : t("detailSheet.actionError"));
    } finally { setIsSubmitting(false); }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
        <div className="flex items-center justify-center gap-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Assignment saved successfully</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("detailSheet.assignIssue")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t("detailSheet.assignDate")}</Label>
          <DatePicker value={issueDraft.assignDate} onChange={(v) => onPatchDraft({ assignDate: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("detailSheet.assignHour")} <span className="text-muted-foreground">({t("common.optional")})</span></Label>
          <TimePicker value={issueDraft.assignHour} onChange={(v) => onPatchDraft({ assignHour: v })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t("detailSheet.selectTechnicians")}</Label>
        <div className="rounded-md border max-h-36 overflow-y-auto divide-y bg-background">
          {activeTechs.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{t("detailSheet.noTechnicians")}</p>
          ) : (
            activeTechs.map((tech) => (
              <button key={tech.id} type="button" onClick={() => toggleTech(tech.id)}
                className={cn("flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-start transition-colors hover:bg-muted/40",
                  issueDraft.assignTechs.includes(tech.id) && "bg-accent")}>
                <div className={cn("h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center",
                  issueDraft.assignTechs.includes(tech.id) ? "bg-primary border-primary" : "border-input")}>
                  {issueDraft.assignTechs.includes(tech.id) && (
                    <span className="text-[9px] text-primary-foreground leading-none">&#10003;</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{tech.name}</p>
                  {tech.categoryName && <p className="truncate text-[10px] text-muted-foreground">{tech.categoryName}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>{t("common.cancel")}</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !issueDraft.assignDate || issueDraft.assignTechs.length === 0}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}
          {t("detailSheet.assign")}
        </Button>
      </div>
    </div>
  );
}

interface DeferPanelProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  issueDraft: IssueDraft;
  onPatchDraft: (patch: Partial<IssueDraft>) => void;
  onClose: () => void;
  onSuccess: () => void;
}

function DeferPanel({ issue, storeId, ticketId, issueDraft, onPatchDraft, onClose, onSuccess }: DeferPanelProps) {
  const t = useTranslations("maintenanceTickets");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (!issueDraft.deferReason.trim()) { setError(t("detailSheet.deferReasonRequired")); return; }
    setIsSubmitting(true); setError(null);
    try {
      await maintenanceTicketsService.deferIssue(storeId, ticketId, issue.id, { reason: issueDraft.deferReason.trim() });
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : t("detailSheet.actionError"));
    } finally { setIsSubmitting(false); }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
        <div className="flex items-center justify-center gap-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Issue deferred successfully</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("detailSheet.deferIssue")}</p>
      <div className="space-y-1">
        <Label className="text-xs">{t("detailSheet.deferReason")} <span className="text-destructive">*</span></Label>
        <Textarea className="text-sm resize-none min-h-20" placeholder={t("detailSheet.deferReasonPlaceholder")}
          value={issueDraft.deferReason} onChange={(e) => onPatchDraft({ deferReason: e.target.value })} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>{t("common.cancel")}</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !issueDraft.deferReason.trim()}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}
          {t("detailSheet.defer")}
        </Button>
      </div>
    </div>
  );
}

interface CancelPanelProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  issueIds?: number[];
  issueDraft: IssueDraft;
  onPatchDraft: (patch: Partial<IssueDraft>) => void;
  onClose: () => void;
  onSuccess: () => void;
}

function CancelPanel({ issue, storeId, ticketId, issueIds, issueDraft, onPatchDraft, onClose, onSuccess }: CancelPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const effectiveIds = issueIds ?? [issue.id];

  async function handleSubmit() {
    if (!issueDraft.cancelReason.trim()) { setError("A cancellation reason is required."); return; }
    setIsSubmitting(true); setError(null);
    try {
      await Promise.all(
        effectiveIds.map((id) =>
          maintenanceTicketsService.cancelIssue(storeId, ticketId, id, { reason: issueDraft.cancelReason.trim() })
        )
      );
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to cancel issue.");
    } finally { setIsSubmitting(false); }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
        <div className="flex items-center justify-center gap-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Issue cancelled successfully</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cancel Issue</p>
      <p className="text-[11px] text-muted-foreground">Cancelling marks the issue as terminal. Unlike deferring, no follow-up issue is created.</p>
      <div className="space-y-1">
        <Label className="text-xs">Reason <span className="text-destructive">*</span></Label>
        <Textarea className="text-sm resize-none min-h-20" placeholder="Explain why this issue is being cancelled"
          value={issueDraft.cancelReason} onChange={(e) => onPatchDraft({ cancelReason: e.target.value })} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" variant="destructive" onClick={handleSubmit} disabled={isSubmitting || !issueDraft.cancelReason.trim()}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}
          Cancel Issue
        </Button>
      </div>
    </div>
  );
}

function asOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toRfc3339OrUndefined(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

interface LifecyclePanelProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  technicians: CatalogTechnician[];
  issueIds?: number[];
  issueDraft: IssueDraft;
  onPatchDraft: (patch: Partial<IssueDraft>) => void;
  onClearDraftFields: (keys: Array<keyof IssueDraft>) => void;
  onClose: () => void;
  onSuccess: () => void;
}

function DiagnosisPanel({ issue, storeId, ticketId, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: Omit<LifecyclePanelProps, "technicians">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [success, setSuccess] = useState(false);
  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      await maintenanceTicketsService.createDiagnosis(storeId, ticketId, {
        ticket_issue_ids: issueIds ?? [issue.id],
        body: issueDraft.diagnosisBody.trim() || "",
      }, files);
      onClearDraftFields(["diagnosisBody"]);
      setFiles([]);
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to create diagnosis.");
    } finally {
      setIsSubmitting(false);
    }
  }
  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
        <div className="flex items-center justify-center gap-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Diagnosis saved successfully</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Diagnosis</p>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Notes</Label>
        <Textarea
          className="text-sm resize-none min-h-20"
          placeholder="Diagnosis notes"
          value={issueDraft.diagnosisBody}
          onChange={(e) => onPatchDraft({ diagnosisBody: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Attachments</Label>
        <Input
          type="file"
          multiple
          className="h-8"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

function WarrantyPanel({ issue, storeId, ticketId, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: Omit<LifecyclePanelProps, "technicians">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [success, setSuccess] = useState(false);
  async function handleSubmit() {
    const body = issueDraft.warrantyBody.trim();
    if (!body) {
      setError("Warranty body is required.");
      return;
    }
    if (!issueDraft.warrantyExpiry) {
      setError("Expiry date is required.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await maintenanceTicketsService.createWarranty(storeId, ticketId, {
        ticket_issue_ids: issueIds ?? [issue.id],
        body,
        expiry_date: issueDraft.warrantyExpiry,
      }, files);
      onClearDraftFields(["warrantyBody", "warrantyExpiry"]);
      setFiles([]);
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to create warranty.");
    } finally {
      setIsSubmitting(false);
    }
  }
  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
        <div className="flex items-center justify-center gap-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Warranty saved successfully</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Warranty</p>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Notes <span className="text-destructive">*</span></Label>
        <Textarea
          className="text-sm resize-none min-h-20"
          placeholder="Warranty notes"
          value={issueDraft.warrantyBody}
          onChange={(e) => onPatchDraft({ warrantyBody: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Expiry date <span className="text-destructive">*</span></Label>
        <DatePicker
          value={issueDraft.warrantyExpiry}
          onChange={(v) => onPatchDraft({ warrantyExpiry: v })}
          placeholder="Pick expiry date"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Attachments</Label>
        <Input
          type="file"
          multiple
          className="h-8"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !issueDraft.warrantyBody.trim() || !issueDraft.warrantyExpiry}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

function AttendancePanel({ issue, storeId, ticketId, technicians, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: LifecyclePanelProps) {
  type ClockEntry   = { uid: number; kind: "start_clock"    | "end_clock";    value: string };
  type BreakEntry   = { uid: number; kind: "start_break"    | "end_break";    value: string };
  type PartsEntry   = { uid: number; kind: "start_parts_run"| "end_parts_run";value: string };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [technicianId, setTechnicianId] = useState(issueDraft.attendanceTechnicianId ?? "");
  const [clockEntries, setClockEntries] = useState<ClockEntry[]>([]);
  const [breakEntries, setBreakEntries] = useState<BreakEntry[]>([]);
  const [partsEntries, setPartsEntries] = useState<PartsEntry[]>([]);
  const uidRef = useRef(0);
  function nextUid() { return uidRef.current++; }

  function addClock()  { setClockEntries((p) => [...p, { uid: nextUid(), kind: "start_clock",     value: "" }]); }
  function addBreak()  { setBreakEntries((p) => [...p, { uid: nextUid(), kind: "start_break",     value: "" }]); }
  function addParts()  { setPartsEntries((p) => [...p, { uid: nextUid(), kind: "start_parts_run", value: "" }]); }

  function patchClock(uid: number, patch: Partial<ClockEntry>) { setClockEntries((p) => p.map((e) => e.uid === uid ? { ...e, ...patch } : e)); }
  function patchBreak(uid: number, patch: Partial<BreakEntry>) { setBreakEntries((p) => p.map((e) => e.uid === uid ? { ...e, ...patch } : e)); }
  function patchParts(uid: number, patch: Partial<PartsEntry>) { setPartsEntries((p) => p.map((e) => e.uid === uid ? { ...e, ...patch } : e)); }

  function removeClock(uid: number) { setClockEntries((p) => p.filter((e) => e.uid !== uid)); }
  function removeBreak(uid: number) { setBreakEntries((p) => p.filter((e) => e.uid !== uid)); }
  function removeParts(uid: number) { setPartsEntries((p) => p.filter((e) => e.uid !== uid)); }

  async function handleSubmit() {
    if (!technicianId) { setError("Technician is required."); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const base = { ticket_issue_ids: issueIds ?? [issue.id], technician_id: Number(technicianId) };
      const calls: Promise<unknown>[] = [];
      for (const e of clockEntries) {
        if (e.value) calls.push(maintenanceTicketsService.createAttendanceEntry(storeId, ticketId, { ...base, [e.kind]: toRfc3339OrUndefined(e.value) }));
      }
      for (const e of breakEntries) {
        if (e.value) calls.push(maintenanceTicketsService.createAttendanceEntry(storeId, ticketId, { ...base, [e.kind]: toRfc3339OrUndefined(e.value) }));
      }
      for (const e of partsEntries) {
        if (e.value) calls.push(maintenanceTicketsService.createAttendanceEntry(storeId, ticketId, { ...base, [e.kind]: toRfc3339OrUndefined(e.value) }));
      }
      if (calls.length === 0) {
        calls.push(maintenanceTicketsService.createAttendanceEntry(storeId, ticketId, base));
      }
      await Promise.all(calls);
      onClearDraftFields([
        "attendanceTechnicianId",
        "attendanceStartClock", "attendanceEndClock",
        "attendanceStartBreak", "attendanceEndBreak",
        "attendanceStartPartsRun", "attendanceEndPartsRun",
      ]);
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to create attendance entry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
        <div className="flex items-center justify-center gap-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Attendance saved successfully</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Attendance</p>

      {/* Technician (required) */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Technician <span className="text-destructive">*</span></Label>
        <Select value={technicianId} onValueChange={setTechnicianId}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select technician" /></SelectTrigger>
          <SelectContent>
            {technicians.filter((tech) => !tech.deletedAt).map((tech) => (
              <SelectItem key={tech.id} value={String(tech.id)}>{tech.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Work Clock */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Work Clock</p>
        {clockEntries.map((entry) => (
          <div key={entry.uid} className="flex items-center gap-2">
            {/* Type toggle */}
            <div className="flex shrink-0 rounded-md border overflow-hidden">
              <button
                type="button"
                onClick={() => patchClock(entry.uid, { kind: "start_clock" })}
                className={cn("px-2.5 py-1 text-xs font-medium transition-colors",
                  entry.kind === "start_clock" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/60")}
              >Clock In</button>
              <button
                type="button"
                onClick={() => patchClock(entry.uid, { kind: "end_clock" })}
                className={cn("px-2.5 py-1 text-xs font-medium border-l transition-colors",
                  entry.kind === "end_clock" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/60")}
              >Clock Out</button>
            </div>
            <div className="flex-1 min-w-0">
              <DateTimePicker
                value={entry.value}
                onChange={(v) => patchClock(entry.uid, { value: v })}
                placeholder={entry.kind === "start_clock" ? "Clock in time" : "Clock out time"}
              />
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeClock(entry.uid)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addClock}>
          <Plus className="me-1 h-3 w-3" /> Add Work Clock
        </Button>
      </div>

      {/* Break */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Break</p>
        {breakEntries.map((entry) => (
          <div key={entry.uid} className="flex items-center gap-2">
            <div className="flex shrink-0 rounded-md border overflow-hidden">
              <button
                type="button"
                onClick={() => patchBreak(entry.uid, { kind: "start_break" })}
                className={cn("px-2.5 py-1 text-xs font-medium transition-colors",
                  entry.kind === "start_break" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/60")}
              >Break Start</button>
              <button
                type="button"
                onClick={() => patchBreak(entry.uid, { kind: "end_break" })}
                className={cn("px-2.5 py-1 text-xs font-medium border-l transition-colors",
                  entry.kind === "end_break" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/60")}
              >Break End</button>
            </div>
            <div className="flex-1 min-w-0">
              <DateTimePicker
                value={entry.value}
                onChange={(v) => patchBreak(entry.uid, { value: v })}
                placeholder={entry.kind === "start_break" ? "Break start time" : "Break end time"}
              />
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeBreak(entry.uid)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addBreak}>
          <Plus className="me-1 h-3 w-3" /> Add Break
        </Button>
      </div>

      {/* Parts Run */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Parts Run</p>
        {partsEntries.map((entry) => (
          <div key={entry.uid} className="flex items-center gap-2">
            <div className="flex shrink-0 rounded-md border overflow-hidden">
              <button
                type="button"
                onClick={() => patchParts(entry.uid, { kind: "start_parts_run" })}
                className={cn("px-2.5 py-1 text-xs font-medium transition-colors",
                  entry.kind === "start_parts_run" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/60")}
              >Depart</button>
              <button
                type="button"
                onClick={() => patchParts(entry.uid, { kind: "end_parts_run" })}
                className={cn("px-2.5 py-1 text-xs font-medium border-l transition-colors",
                  entry.kind === "end_parts_run" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/60")}
              >Return</button>
            </div>
            <div className="flex-1 min-w-0">
              <DateTimePicker
                value={entry.value}
                onChange={(v) => patchParts(entry.uid, { value: v })}
                placeholder={entry.kind === "start_parts_run" ? "Depart time" : "Return time"}
              />
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeParts(entry.uid)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addParts}>
          <Plus className="me-1 h-3 w-3" /> Add Parts Run
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !technicianId}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

function PartUsagePanel({ issue, storeId, ticketId, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: Omit<LifecyclePanelProps, "technicians">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [catalogParts, setCatalogParts] = useState<CatalogPart[]>([]);
  const [partsLoading, setPartsLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    setPartsLoading(true);
    maintenanceTicketsService.getCatalogParts(ctrl.signal)
      .then((parts) => setCatalogParts(parts.filter((p) => !p.deletedAt)))
      .catch(() => {})
      .finally(() => setPartsLoading(false));
    return () => ctrl.abort();
  }, []);

  /** Creates a catalog part and returns the new id. Called by SearchCreateCombobox. */
  async function createCatalogPart(name: string): Promise<number> {
    const newPart = await maintenanceTicketsService.createCatalogPart({ name });
    setCatalogParts((prev) => [...prev, newPart]);
    return newPart.id;
  }

  async function handleSubmit() {
    const partId = asOptionalNumber(issueDraft.partId);
    const partCost = asOptionalNumber(issueDraft.partCost);
    if (!partId || partCost == null) {
      setError("Part and cost are required.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await maintenanceTicketsService.createPartUsage(storeId, ticketId, {
        ticket_issue_ids: issueIds ?? [issue.id],
        part_id: partId,
        cost: partCost,
      }, files);
      onClearDraftFields(["partId", "partCost"]);
      setFiles([]);
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to create part usage.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
        <div className="flex items-center justify-center gap-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Part usage saved successfully</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Part Usage</p>

      {/* Part search + create */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Part <span className="text-destructive">*</span></Label>
        <SearchCreateCombobox
          items={catalogParts.map((p) => ({ id: p.id, label: p.name }))}
          selectedId={asOptionalNumber(issueDraft.partId) ?? null}
          onSelect={(id) => onPatchDraft({ partId: id != null ? String(id) : "" })}
          onCreate={createCatalogPart}
          placeholder="Search parts or type to create a new one…"
          loading={partsLoading}
        />
      </div>

      {/* Cost */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Cost ($) <span className="text-destructive">*</span></Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          className="h-8"
          placeholder="0.00"
          value={issueDraft.partCost}
          onChange={(e) => onPatchDraft({ partCost: e.target.value })}
        />
      </div>

      {/* Attachments */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Attachments</Label>
        <Input
          type="file"
          multiple
          className="h-8"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || partsLoading}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

function PayEntryPanel({ issue, storeId, ticketId, technicians, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: LifecyclePanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  async function handleSubmit() {
    if (!issueDraft.payTechnicianId) {
      setError("Technician is required.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await maintenanceTicketsService.createPayEntry(storeId, ticketId, {
        ticket_issue_ids: issueIds ?? [issue.id],
        technician_id: Number(issueDraft.payTechnicianId),
        base_pay: asOptionalNumber(issueDraft.basePay),
        performance_pay: asOptionalNumber(issueDraft.performancePay),
        driving_base_pay: asOptionalNumber(issueDraft.drivingBasePay),
        driving_performance_pay: asOptionalNumber(issueDraft.drivingPerformancePay),
        driving_time: asOptionalNumber(issueDraft.drivingTime),
        miles_driven: asOptionalNumber(issueDraft.milesDriven),
        per_mile_rate: asOptionalNumber(issueDraft.perMileRate),
      });
      onClearDraftFields([
        "payTechnicianId",
        "basePay",
        "performancePay",
        "drivingBasePay",
        "drivingPerformancePay",
        "drivingTime",
        "milesDriven",
        "perMileRate",
      ]);
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to create pay entry.");
    } finally {
      setIsSubmitting(false);
    }
  }
  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
        <div className="flex items-center justify-center gap-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Pay entry saved successfully</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Pay Entry</p>
      <Select value={issueDraft.payTechnicianId} onValueChange={(v) => onPatchDraft({ payTechnicianId: v })}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select technician" /></SelectTrigger>
        <SelectContent>
          {technicians.filter((tech) => !tech.deletedAt).map((tech) => (
            <SelectItem key={tech.id} value={String(tech.id)}>{tech.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input type="number" className="h-8" placeholder="Base pay" value={issueDraft.basePay} onChange={(e) => onPatchDraft({ basePay: e.target.value })} />
        <Input type="number" className="h-8" placeholder="Performance pay" value={issueDraft.performancePay} onChange={(e) => onPatchDraft({ performancePay: e.target.value })} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !issueDraft.payTechnicianId}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

function AttachTechsPanel({ issue, storeId, ticketId, technicians, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: LifecyclePanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  function toggleTech(id: number) {
    const current = issueDraft.attachTechs;
    onPatchDraft({ attachTechs: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
  }
  async function handleSubmit() {
    if (issueDraft.attachTechs.length === 0) {
      setError("Select at least one technician.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await maintenanceTicketsService.attachTechnicians(storeId, ticketId, {
        ticket_issue_ids: issueIds ?? [issue.id],
        technician_ids: issueDraft.attachTechs,
      });
      onClearDraftFields(["attachTechs"]);
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to attach technicians.");
    } finally {
      setIsSubmitting(false);
    }
  }
  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
        <div className="flex items-center justify-center gap-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Technicians attached successfully</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attach Technicians</p>
      <div className="rounded-md border max-h-36 overflow-y-auto divide-y bg-background">
        {technicians.filter((tech) => !tech.deletedAt).map((tech) => (
          <button key={tech.id} type="button" onClick={() => toggleTech(tech.id)}
            className={cn("flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-start transition-colors hover:bg-muted/40",
              issueDraft.attachTechs.includes(tech.id) && "bg-accent")}>
            <div className={cn("h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center",
              issueDraft.attachTechs.includes(tech.id) ? "bg-primary border-primary" : "border-input")}>
              {issueDraft.attachTechs.includes(tech.id) && <span className="text-[9px] text-primary-foreground leading-none">&#10003;</span>}
            </div>
            <p className="truncate text-xs font-medium">{tech.name}</p>
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || issueDraft.attachTechs.length === 0}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

function DelayAssignmentPanel({ issue, storeId, ticketId, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: Omit<LifecyclePanelProps, "technicians">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const canSubmit = !!issueDraft.delayAssignmentId && !!issueDraft.delayNewDate && !!issueDraft.delayReason.trim();
  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      await maintenanceTicketsService.delayAssignment(
        storeId,
        ticketId,
        Number(issueDraft.delayAssignmentId),
        {
          new_date: issueDraft.delayNewDate,
          new_hour: issueDraft.delayNewHour || undefined,
          reason: issueDraft.delayReason.trim(),
        }
      );
      onClearDraftFields(["delayAssignmentId", "delayNewDate", "delayNewHour", "delayReason"]);
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to delay assignment.");
    } finally {
      setIsSubmitting(false);
    }
  }
  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
        <div className="flex items-center justify-center gap-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Assignment delayed successfully</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Delay Assignment</p>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Assignment <span className="text-destructive">*</span></Label>
        <Select value={issueDraft.delayAssignmentId} onValueChange={(v) => onPatchDraft({ delayAssignmentId: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select assignment" /></SelectTrigger>
          <SelectContent>
            {issue.assignments.map((assignment) => (
              <SelectItem key={assignment.id} value={String(assignment.id)}>
                #{assignment.id} · {fmtDate(assignment.assignedDate)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">New date <span className="text-destructive">*</span></Label>
          <DatePicker value={issueDraft.delayNewDate} onChange={(v) => onPatchDraft({ delayNewDate: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">New time <span className="text-muted-foreground/60">(optional)</span></Label>
          <TimePicker value={issueDraft.delayNewHour} onChange={(v) => onPatchDraft({ delayNewHour: v })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Reason <span className="text-destructive">*</span></Label>
        <Textarea className="text-sm resize-none min-h-20" placeholder="Explain why the assignment is being delayed" value={issueDraft.delayReason} onChange={(e) => onPatchDraft({ delayReason: e.target.value })} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !canSubmit}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

function ChangeTechsPanel({ issue, storeId, ticketId, technicians, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: LifecyclePanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  function toggleTech(id: number) {
    const current = issueDraft.changeTechs;
    onPatchDraft({ changeTechs: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
  }
  async function handleSubmit() {
    if (!issueDraft.changeAssignmentId || issueDraft.changeTechs.length === 0) {
      setError("Assignment and technicians are required.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await maintenanceTicketsService.changeAssignmentTechnicians(
        storeId,
        ticketId,
        Number(issueDraft.changeAssignmentId),
        { technician_ids: issueDraft.changeTechs }
      );
      onClearDraftFields(["changeAssignmentId", "changeTechs"]);
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to change technicians.");
    } finally {
      setIsSubmitting(false);
    }
  }
  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
        <div className="flex items-center justify-center gap-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Technicians updated successfully</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Change Assignment Technicians</p>
      <Select value={issueDraft.changeAssignmentId} onValueChange={(v) => onPatchDraft({ changeAssignmentId: v })}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select assignment" /></SelectTrigger>
        <SelectContent>
          {issue.assignments.map((assignment) => (
            <SelectItem key={assignment.id} value={String(assignment.id)}>
              #{assignment.id} · {fmtDate(assignment.assignedDate)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="rounded-md border max-h-36 overflow-y-auto divide-y bg-background">
        {technicians.filter((tech) => !tech.deletedAt).map((tech) => (
          <button key={tech.id} type="button" onClick={() => toggleTech(tech.id)}
            className={cn("flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-start transition-colors hover:bg-muted/40",
              issueDraft.changeTechs.includes(tech.id) && "bg-accent")}>
            <div className={cn("h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center",
              issueDraft.changeTechs.includes(tech.id) ? "bg-primary border-primary" : "border-input")}>
              {issueDraft.changeTechs.includes(tech.id) && <span className="text-[9px] text-primary-foreground leading-none">&#10003;</span>}
            </div>
            <p className="truncate text-xs font-medium">{tech.name}</p>
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !issueDraft.changeAssignmentId || issueDraft.changeTechs.length === 0}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Bulk action bar — shown when ≥1 issue is selected in select mode       */
/* ────────────────────────────────────────────────────────────────────────── */

type BulkAction =
  | "status"
  | "assign"
  | "cancel"
  | "diagnosis"
  | "attendance"
  | "part"
  | "pay"
  | "warranty"
  | "attachTechs";

/**
 * Minimal stub passed to action panels in bulk mode.
 * `issueIds` prop always overrides the `.id` so this stub is never used
 * for API calls — it only satisfies TypeScript.
 */
const BULK_DUMMY_ISSUE = {
  id: 0,
  status: { value: "pending", label: "Pending" },
  priority: { value: "medium", label: "Medium" },
  issueTitle: null,
  otherTitle: null,
  description: null,
  technicians: [],
  assignments: [],
  diagnoses: [],
  attendanceEntries: [],
  partUsages: [],
  payEntries: [],
  warranties: [],
  statusChanges: [],
  children: [],
  parentId: null,
} as unknown as TicketIssue;

interface BulkActionBarProps {
  issueIds: number[];
  storeId: string;
  ticketId: number;
  technicians: CatalogTechnician[];
  attendanceTechnicians?: CatalogTechnician[];
  onClear: () => void;
  onSuccess: () => void;
}

function BulkActionBar({ issueIds, storeId, ticketId, technicians, attendanceTechnicians, onClear, onSuccess }: BulkActionBarProps) {
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkDraft, setBulkDraft] = useState<IssueDraft>(EMPTY_ISSUE_DRAFT);

  function patchDraft(patch: Partial<IssueDraft>) {
    setBulkDraft((prev) => ({ ...prev, ...patch }));
  }

  function clearDraftFields(keys: Array<keyof IssueDraft>) {
    setBulkDraft((prev) => {
      const next = { ...prev };
      keys.forEach((k) => { (next as Record<keyof IssueDraft, unknown>)[k] = EMPTY_ISSUE_DRAFT[k]; });
      return next;
    });
  }

  function handleActionSuccess() {
    setBulkAction(null);
    setBulkDraft(EMPTY_ISSUE_DRAFT);
    onSuccess();
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 mb-4 p-3 space-y-3">
      {/* Selection header row */}
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium flex-1">
          {issueIds.length} issue{issueIds.length !== 1 ? "s" : ""} selected
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="default" className="h-7 text-xs gap-1">
              Apply action <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setBulkAction("status")}>
              <FileText className="h-4 w-4" />Change status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBulkAction("assign")}>
              <UserRoundPlus className="h-4 w-4" />Assign issues
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBulkAction("cancel")} className="text-destructive focus:text-destructive">
              <X className="h-4 w-4" />Cancel issues
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBulkAction("diagnosis")}>
              <FileText className="h-4 w-4" />Add diagnosis
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBulkAction("attendance")}>
              <Wrench className="h-4 w-4" />Add attendance
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBulkAction("part")}>
              <Package className="h-4 w-4" />Add part usage
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBulkAction("pay")}>
              <Wallet className="h-4 w-4" />Add pay entry
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBulkAction("warranty")}>
              <ShieldCheck className="h-4 w-4" />Add warranty
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBulkAction("attachTechs")}>
              <Users2 className="h-4 w-4" />Attach technicians
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClear}>
          Clear
        </Button>
      </div>

      {/* Inline action form */}
      {bulkAction === "status" && (
        <ChangeStatusPanel issue={BULK_DUMMY_ISSUE} storeId={storeId} ticketId={ticketId}
          issueIds={issueIds} onClose={() => setBulkAction(null)} onSuccess={handleActionSuccess} />
      )}
      {bulkAction === "assign" && (
        <AssignPanel issue={BULK_DUMMY_ISSUE} storeId={storeId} ticketId={ticketId}
          technicians={technicians} issueIds={issueIds}
          issueDraft={bulkDraft} onPatchDraft={patchDraft}
          onClose={() => setBulkAction(null)} onSuccess={handleActionSuccess} />
      )}
      {bulkAction === "cancel" && (
        <CancelPanel issue={BULK_DUMMY_ISSUE} storeId={storeId} ticketId={ticketId}
          issueIds={issueIds}
          issueDraft={bulkDraft} onPatchDraft={patchDraft}
          onClose={() => setBulkAction(null)} onSuccess={handleActionSuccess} />
      )}
      {bulkAction === "diagnosis" && (
        <DiagnosisPanel issue={BULK_DUMMY_ISSUE} storeId={storeId} ticketId={ticketId}
          issueIds={issueIds}
          issueDraft={bulkDraft} onPatchDraft={patchDraft} onClearDraftFields={clearDraftFields}
          onClose={() => setBulkAction(null)} onSuccess={handleActionSuccess} />
      )}
      {bulkAction === "attendance" && (
        <AttendancePanel issue={BULK_DUMMY_ISSUE} storeId={storeId} ticketId={ticketId}
          technicians={attendanceTechnicians ?? technicians} issueIds={issueIds}
          issueDraft={bulkDraft} onPatchDraft={patchDraft} onClearDraftFields={clearDraftFields}
          onClose={() => setBulkAction(null)} onSuccess={handleActionSuccess} />
      )}
      {bulkAction === "part" && (
        <PartUsagePanel issue={BULK_DUMMY_ISSUE} storeId={storeId} ticketId={ticketId}
          issueIds={issueIds}
          issueDraft={bulkDraft} onPatchDraft={patchDraft} onClearDraftFields={clearDraftFields}
          onClose={() => setBulkAction(null)} onSuccess={handleActionSuccess} />
      )}
      {bulkAction === "pay" && (
        <PayEntryPanel issue={BULK_DUMMY_ISSUE} storeId={storeId} ticketId={ticketId}
          technicians={technicians} issueIds={issueIds}
          issueDraft={bulkDraft} onPatchDraft={patchDraft} onClearDraftFields={clearDraftFields}
          onClose={() => setBulkAction(null)} onSuccess={handleActionSuccess} />
      )}
      {bulkAction === "warranty" && (
        <WarrantyPanel issue={BULK_DUMMY_ISSUE} storeId={storeId} ticketId={ticketId}
          issueIds={issueIds}
          issueDraft={bulkDraft} onPatchDraft={patchDraft} onClearDraftFields={clearDraftFields}
          onClose={() => setBulkAction(null)} onSuccess={handleActionSuccess} />
      )}
      {bulkAction === "attachTechs" && (
        <AttachTechsPanel issue={BULK_DUMMY_ISSUE} storeId={storeId} ticketId={ticketId}
          technicians={technicians} issueIds={issueIds}
          issueDraft={bulkDraft} onPatchDraft={patchDraft} onClearDraftFields={clearDraftFields}
          onClose={() => setBulkAction(null)} onSuccess={handleActionSuccess} />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Status history (collapsible sub-section)                               */
/* ────────────────────────────────────────────────────────────────────────── */

function StatusHistory({ changes }: { changes: TicketIssue["statusChanges"] }) {
  const t = useTranslations("maintenanceTickets");
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t pt-2 mt-1">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {t("detailSheet.statusHistory")} ({changes.length})
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 ps-4 border-s">
          {changes.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusChip label={c.status.label} />
              {c.changedBy && <span className="flex items-center gap-1"><User className="h-2.5 w-2.5" />{c.changedBy}</span>}
              <span>{fmtDateTime(c.createdAt)}</span>
              {c.reason && <span className="italic">"{c.reason}"</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Issue node — tree connector + card + inline actions                    */
/* ────────────────────────────────────────────────────────────────────────── */

type ActiveAction =
  | null
  | "status"
  | "assign"
  | "defer"
  | "cancel"
  | "diagnosis"
  | "attendance"
  | "part"
  | "pay"
  | "warranty"
  | "attachTechs"
  | "delayAssignment"
  | "changeTechs";

/* ─── GroupSection ───────────────────────────────────────────────────────── */
function GroupSection({
  label,
  count,
  subtitle,
  actionKind,
  children,
}: {
  label: string;
  count: number;
  subtitle?: string;
  /** null = not an action group (status/priority); shared/solo = action-based group */
  actionKind?: "shared" | "solo" | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 pb-2 text-start group"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
          {label}
        </span>
        <span className="ms-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {count}
        </span>
        {actionKind === "shared" && (
          <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
            Shared action
          </span>
        )}
        {actionKind === "solo" && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Solo action
          </span>
        )}
        <div className="flex-1 h-px bg-border ms-1" />
      </button>
      {open && (
        <div>
          {subtitle && (
            <p className="mb-2 text-[11px] text-muted-foreground italic ps-5">
              {subtitle}
            </p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

interface IssueNodeProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  technicians: CatalogTechnician[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  issueDraft: IssueDraft;
  onPatchDraft: (patch: Partial<IssueDraft>) => void;
  onClearDraftFields: (keys: Array<keyof IssueDraft>) => void;
  onReload: () => void;
  depth?: number;
  isLast?: boolean;
  /** Multi-select */
  isSelectMode?: boolean;
  selectedIssueIds?: ReadonlySet<number>;
  onToggleSelectId?: (id: number) => void;
  /** IDs of part_usage records that appear on more than one issue */
  sharedPartIds?: ReadonlySet<number>;
  /** IDs of attendance_entry records that appear on more than one issue */
  sharedAttendanceIds?: ReadonlySet<number>;
  /** IDs of pay_entry records that appear on more than one issue */
  sharedPayIds?: ReadonlySet<number>;
  /** IDs of warranty records that appear on more than one issue */
  sharedWarrantyIds?: ReadonlySet<number>;
  /** IDs of diagnosis records that appear on more than one issue */
  sharedDiagnosisIds?: ReadonlySet<number>;
  /** map: record id -> all issue ids that share this part usage record */
  sharedPartIssueIdsByRecordId?: ReadonlyMap<number, number[]>;
  /** map: record id -> all issue ids that share this attendance record */
  sharedAttendanceIssueIdsByRecordId?: ReadonlyMap<number, number[]>;
  /** map: record id -> all issue ids that share this pay entry record */
  sharedPayIssueIdsByRecordId?: ReadonlyMap<number, number[]>;
  /** map: record id -> all issue ids that share this warranty record */
  sharedWarrantyIssueIdsByRecordId?: ReadonlyMap<number, number[]>;
  /** map: record id -> all issue ids that share this diagnosis record */
  sharedDiagnosisIssueIdsByRecordId?: ReadonlyMap<number, number[]>;
  /** map: issue id -> display title */
  issueTitleById?: ReadonlyMap<number, string>;
  /** trigger transient highlight animation for issue cards */
  onHighlightIssues?: (issueIds: number[]) => void;
  /** show shared indicator chip in card header row (used for no-grouping mode) */
  showSharedIndicatorWhenCollapsed?: boolean;
  /** whether this card should show transient highlight animation */
  isHighlighted?: boolean;
}

function IssueNode({
  issue,
  storeId,
  ticketId,
  technicians,
  isExpanded,
  onToggleExpand,
  issueDraft,
  onPatchDraft,
  onClearDraftFields,
  onReload,
  depth = 0,
  isLast = false,
  isSelectMode = false,
  selectedIssueIds,
  onToggleSelectId,
  sharedPartIds,
  sharedAttendanceIds,
  sharedPayIds,
  sharedWarrantyIds,
  sharedDiagnosisIds,
  sharedPartIssueIdsByRecordId,
  sharedAttendanceIssueIdsByRecordId,
  sharedPayIssueIdsByRecordId,
  sharedWarrantyIssueIdsByRecordId,
  sharedDiagnosisIssueIdsByRecordId,
  issueTitleById,
  onHighlightIssues,
  showSharedIndicatorWhenCollapsed = false,
  isHighlighted = false,
}: IssueNodeProps) {
  const t = useTranslations("maintenanceTickets");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [mistakenSaving, setMistakenSaving] = useState<string | null>(null);

  const title = issue.issueTitle ?? issue.otherTitle ?? `Issue #${issue.id}`;
  const hasSharedAction =
    issue.partUsages.some((item) => Boolean(sharedPartIds?.has(item.id))) ||
    issue.attendanceEntries.some((item) => Boolean(sharedAttendanceIds?.has(item.id))) ||
    issue.payEntries.some((item) => Boolean(sharedPayIds?.has(item.id))) ||
    issue.warranties.some((item) => Boolean(sharedWarrantyIds?.has(item.id))) ||
    issue.diagnoses.some((item) => Boolean(sharedDiagnosisIds?.has(item.id)));
  const canAssign = ["pending", "assigned"].includes(issue.status.value);
  const canDefer = issue.status.value !== "complete";
  const canCancel = !["complete", "cancelled"].includes(issue.status.value);

  function toggleAction(action: ActiveAction) {
    setActiveAction((prev) => (prev === action ? null : action));
  }

  return (
    <div className="relative">
      {/* Vertical connector line (non-last) */}
      {!isLast && (
        <div className="absolute start-2.25 top-5 bottom-0 w-px bg-border" />
      )}

      <div className="relative flex gap-3">
        {/* Node dot / select checkbox */}
        <div className="relative flex flex-col items-center shrink-0 mt-0.5">
          {isSelectMode ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSelectId?.(issue.id); }}
              className={cn(
                "h-5 w-5 rounded border-2 flex items-center justify-center z-10 transition-colors shrink-0",
                selectedIssueIds?.has(issue.id)
                  ? "bg-primary border-primary"
                  : "border-border bg-background hover:border-primary/60"
              )}
            >
              {selectedIssueIds?.has(issue.id) && (
                <span className="text-[9px] text-primary-foreground font-bold leading-none">&#10003;</span>
              )}
            </button>
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-border bg-background flex items-center justify-center z-10">
              <div className="h-1.5 w-1.5 rounded-full bg-foreground" />
            </div>
          )}
        </div>

        {/* Card */}
        <div className="flex-1 min-w-0 pb-4">
          <div
            data-issue-id={issue.id}
            className={cn(
              "relative rounded-lg border bg-card overflow-hidden transition-colors",
              isHighlighted && "ring-2 ring-muted-foreground/40"
            )}
          >
            {isHighlighted && (
              <div className="pointer-events-none absolute inset-0 z-0 bg-muted/45 animate-pulse" />
            )}
            {/* Header (always visible) */}
            <button type="button" onClick={onToggleExpand}
              className="relative z-10 w-full flex items-start gap-2 sm:gap-3 px-3 sm:px-4 py-3 text-start hover:bg-muted/30 transition-colors group">
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {issue.parentId != null && (
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      {t("detailSheet.deferred")} ·{" "}
                    </span>
                  )}
                  <span className="text-sm font-semibold">{title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusChip label={issue.status.label} />
                  <PriorityChip label={issue.priority.label} />
                  {showSharedIndicatorWhenCollapsed && hasSharedAction && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                      Shared
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-muted-foreground">#{issue.id}</span>
                  {issue.creator && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <User className="h-2.5 w-2.5" />{issue.creator.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-muted-foreground mt-0.5 group-hover:text-foreground transition-colors">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </button>

            {/* Expandable body */}
            {isExpanded && (
              <div className="relative z-10 border-t px-3 sm:px-4 py-3 space-y-3">
                {/* Description */}
                {issue.description ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">{issue.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">{t("detailSheet.noDescription")}</p>
                )}

                {/* Technicians */}
                {issue.technicians.length > 0 && <hr className="border-border" />}
                {issue.technicians.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {issue.technicians.map((tech) => (
                      <span key={tech.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />{tech.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Assignments */}
                {issue.assignments.length > 0 && <hr className="border-border" />}
                {issue.assignments.length > 0 && (
                  <div className="space-y-1.5">
                    {issue.assignments.map((a) => (
                      <div key={a.id} className={cn("rounded border bg-muted/10 px-2 py-1.5 space-y-1", a.mistaken && "opacity-60")}>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <CalendarIcon className="h-3 w-3 shrink-0" />
                          <span>{fmtDate(a.assignedDate)}</span>
                          {a.assignedHour && <><ClockIcon className="h-3 w-3 shrink-0" /><span>{a.assignedHour}</span></>}
                          {a.technicians.length > 0 && (
                            <span>· {a.technicians.map((tech) => tech.name).join(", ")}</span>
                          )}
                          {a.mistaken && <span className="rounded-full border px-1.5 py-px text-[10px]">mistaken</span>}
                          {!a.mistaken && (
                            <button
                              type="button"
                              className="ms-auto text-[10px] text-destructive/70 hover:text-destructive transition-colors disabled:pointer-events-none"
                              disabled={mistakenSaving !== null}
                              onClick={async () => {
                                setMistakenSaving(`assignment:${a.id}`);
                                try { await maintenanceTicketsService.markAssignmentMistaken(storeId, ticketId, a.id); onReload(); }
                                catch { /* noop */ }
                                finally { setMistakenSaving(null); }
                              }}
                            >
                              {mistakenSaving === `assignment:${a.id}` ? "…" : "Mark mistaken"}
                            </button>
                          )}
                        </div>
                        {a.delays.length > 0 && (
                          <div className="ps-4 border-s space-y-1">
                            {a.delays.map((delay) => (
                              <div key={delay.id} className={cn("text-[11px] text-muted-foreground flex flex-wrap items-center gap-2", delay.mistaken && "opacity-60")}>
                                <TimerReset className="h-3 w-3 shrink-0" />
                                <span className={delay.mistaken ? "line-through" : ""}>Delayed to {fmtDate(delay.newDate)}{delay.newHour ? ` ${delay.newHour}` : ""}</span>
                                <span className="italic">{delay.reason}</span>
                                {delay.mistaken && <span className="rounded-full border px-1.5 py-px text-[9px]">mistaken</span>}
                                {!delay.mistaken && (
                                  <button
                                    type="button"
                                    className="ms-auto text-[10px] text-destructive/70 hover:text-destructive transition-colors disabled:pointer-events-none"
                                    disabled={mistakenSaving !== null}
                                    onClick={async () => {
                                      setMistakenSaving(`delay:${delay.id}`);
                                      try { await maintenanceTicketsService.markAssignmentDelayMistaken(storeId, ticketId, a.id, delay.id); onReload(); }
                                      catch { /* noop */ }
                                      finally { setMistakenSaving(null); }
                                    }}
                                  >
                                    {mistakenSaving === `delay:${delay.id}` ? "…" : "Mark mistaken"}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <EntityNotesAttachments
                          entityPath={entityPaths.assignment(storeId, ticketId, a.id)}
                          notes={a.notes}
                          attachments={a.attachments}
                          onSuccess={onReload}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Lifecycle timeline rows */}
                {issue.diagnoses.length > 0 && <hr className="border-border" />}
                {issue.diagnoses.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Diagnoses</p>
                    {issue.diagnoses.map((item) => {
                      const sharedWithIds = (sharedDiagnosisIssueIdsByRecordId?.get(item.id) ?? [])
                        .filter((id) => id !== issue.id);
                      const isShared = Boolean(sharedDiagnosisIds?.has(item.id));
                      const idsToHighlight = [issue.id, ...sharedWithIds];
                      return (
                        <div key={item.id} className={cn("text-xs rounded border px-2 py-1.5 space-y-1", item.mistaken && "opacity-60 line-through")}>
                          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            <span className="text-foreground">{item.body || "No notes"}</span>
                            {item.mistaken && <span className="rounded-full border px-1.5 py-px text-[10px]">mistaken</span>}
                            {!item.mistaken && (
                              <button
                                type="button"
                                className="text-[10px] text-destructive/70 hover:text-destructive transition-colors disabled:pointer-events-none"
                                disabled={mistakenSaving !== null}
                                onClick={async () => {
                                  setMistakenSaving(`diagnosis:${item.id}`);
                                  try { await maintenanceTicketsService.markDiagnosisMistaken(storeId, ticketId, item.id); onReload(); }
                                  catch { /* noop */ }
                                  finally { setMistakenSaving(null); }
                                }}
                              >
                                {mistakenSaving === `diagnosis:${item.id}` ? "…" : "Mark mistaken"}
                              </button>
                            )}
                            {item.createdBy != null && (
                              <span className="flex items-center gap-0.5 text-[10px]">
                                <User className="h-2.5 w-2.5" />#{item.createdBy}
                              </span>
                            )}
                            {isShared && (
                              <span className="ms-auto rounded-full bg-blue-500/10 px-1.5 py-px text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                Shared action
                              </span>
                            )}
                          </div>
                          {isShared && sharedWithIds.length > 0 && (
                            <div className="ps-5 text-[11px] text-muted-foreground">
                              Shared with:{" "}
                              {sharedWithIds.map((otherId, index) => (
                                <span key={otherId}>
                                  <button
                                    type="button"
                                    className="underline decoration-dotted underline-offset-2 text-foreground hover:text-primary transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onHighlightIssues?.(idsToHighlight);
                                      const el = document.querySelector<HTMLElement>(`[data-issue-id="${otherId}"]`);
                                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                                    }}
                                  >
                                    {issueTitleById?.get(otherId) ?? `Issue #${otherId}`}
                                  </button>
                                  {index < sharedWithIds.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        {item.attachments.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {item.attachments.map((attachment, index) => {
                              const hasUrl = Boolean(attachment.url);
                              const attachmentLabel = `Attachment ${index + 1}`;
                              const mimeType = (attachment.contentType || "").toLowerCase();
                              const lowerUrl = (attachment.url || "").toLowerCase();
                              const lowerFileName = (attachment.fileName || "").toLowerCase();
                              const isImage =
                                mimeType.startsWith("image/") ||
                                /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerUrl) ||
                                /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerFileName);

                              if (!hasUrl) {
                                return (
                                  <span
                                    key={attachment.id}
                                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/40"
                                    title={`${attachmentLabel} (missing URL)`}
                                  >
                                    <Paperclip className="h-4 w-4" />
                                    <span>{attachmentLabel}</span>
                                  </span>
                                );
                              }

                              if (isImage) {
                                return (
                                  <a
                                    key={attachment.id}
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center"
                                    title={attachment.fileName || attachmentLabel}
                                    aria-label={`Open ${attachment.fileName || attachmentLabel} in new tab`}
                                  >
                                    <img
                                      src={attachment.url}
                                      alt={attachment.fileName || attachmentLabel}
                                      className="h-16 w-16 rounded-sm border object-cover"
                                      loading="lazy"
                                    />
                                  </a>
                                );
                              }

                              return (
                                <a
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                                  title={attachment.fileName || attachmentLabel}
                                  aria-label={`Open ${attachmentLabel} in new tab`}
                                >
                                  <Paperclip className="h-4 w-4" />
                                  <span>{attachmentLabel}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}
                        <EntityNotesAttachments
                          entityPath={entityPaths.diagnosis(storeId, ticketId, item.id)}
                          notes={item.notes}
                          attachments={[]}
                          onSuccess={onReload}
                        />
                      </div>
                      );
                    })}
                  </div>
                )}

                {issue.attendanceEntries.length > 0 && <hr className="border-border" />}
                {issue.attendanceEntries.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Attendance</p>
                    {issue.attendanceEntries.map((item) => {
                      const sharedWithIds = (sharedAttendanceIssueIdsByRecordId?.get(item.id) ?? [])
                        .filter((id) => id !== issue.id);
                      const isShared = Boolean(sharedAttendanceIds?.has(item.id));
                      const idsToHighlight = [issue.id, ...sharedWithIds];
                      return (
                        <div key={item.id} className={cn("text-xs rounded border px-2 py-2 space-y-1.5", item.mistaken && "opacity-60")}>
                          {/* Header row: technician + badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <Wrench className="h-3 w-3 shrink-0" />
                            <span className="font-medium">{item.technician?.name ?? `Technician #${item.technicianId}`}</span>
                            {item.mistaken && <span className="rounded-full border px-1.5 py-px text-[10px] line-through">mistaken</span>}
                            {!item.mistaken && (
                              <button
                                type="button"
                                className="text-[10px] text-destructive/70 hover:text-destructive transition-colors disabled:pointer-events-none"
                                disabled={mistakenSaving !== null}
                                onClick={async () => {
                                  setMistakenSaving(`attendance:${item.id}`);
                                  try { await maintenanceTicketsService.markAttendanceMistaken(storeId, ticketId, item.id); onReload(); }
                                  catch { /* noop */ }
                                  finally { setMistakenSaving(null); }
                                }}
                              >
                                {mistakenSaving === `attendance:${item.id}` ? "…" : "Mark mistaken"}
                              </button>
                            )}
                            {item.createdBy != null && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <User className="h-2.5 w-2.5" />#{item.createdBy}
                              </span>
                            )}
                            {isShared && (
                              <span className="ms-auto rounded-full bg-blue-500/10 px-1.5 py-px text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                Shared action
                              </span>
                            )}
                          </div>
                          {/* Time sections */}
                          {(item.startClock || item.endClock) && (() => {
                            const dur = (item.startClock && item.endClock) ? calcDuration(item.startClock, item.endClock) : null;
                            return (
                              <div className="ps-5 space-y-1">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Work Clock</span>
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                                  {item.startClock
                                    ? <span className="text-muted-foreground">Clock in: <span className="text-foreground">{fmtDateTime(item.startClock)}</span></span>
                                    : <span className="text-[10px] text-muted-foreground/50 italic">Missing clock in</span>
                                  }
                                  {item.endClock
                                    ? <span className="text-muted-foreground">Clock out: <span className="text-foreground">{fmtDateTime(item.endClock)}</span></span>
                                    : <span className="text-[10px] text-muted-foreground/50 italic">Missing clock out</span>
                                  }
                                </div>
                                {dur && (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <ClockIcon className="h-3 w-3 shrink-0" />
                                    <span>Duration: <span className="text-foreground font-medium">{dur}</span></span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {(item.startBreak || item.endBreak) && (() => {
                            const dur = (item.startBreak && item.endBreak) ? calcDuration(item.startBreak, item.endBreak) : null;
                            return (
                              <div className="ps-5 space-y-1">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Break</span>
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                                  {item.startBreak
                                    ? <span className="text-muted-foreground">Start: <span className="text-foreground">{fmtDateTime(item.startBreak)}</span></span>
                                    : <span className="text-[10px] text-muted-foreground/50 italic">Missing break start</span>
                                  }
                                  {item.endBreak
                                    ? <span className="text-muted-foreground">End: <span className="text-foreground">{fmtDateTime(item.endBreak)}</span></span>
                                    : <span className="text-[10px] text-muted-foreground/50 italic">Missing break end</span>
                                  }
                                </div>
                                {dur && (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <ClockIcon className="h-3 w-3 shrink-0" />
                                    <span>Duration: <span className="text-foreground font-medium">{dur}</span></span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {(item.startPartsRun || item.endPartsRun) && (() => {
                            const dur = (item.startPartsRun && item.endPartsRun) ? calcDuration(item.startPartsRun, item.endPartsRun) : null;
                            return (
                              <div className="ps-5 space-y-1">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Parts Run</span>
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                                  {item.startPartsRun
                                    ? <span className="text-muted-foreground">Depart: <span className="text-foreground">{fmtDateTime(item.startPartsRun)}</span></span>
                                    : <span className="text-[10px] text-muted-foreground/50 italic">Missing depart time</span>
                                  }
                                  {item.endPartsRun
                                    ? <span className="text-muted-foreground">Return: <span className="text-foreground">{fmtDateTime(item.endPartsRun)}</span></span>
                                    : <span className="text-[10px] text-muted-foreground/50 italic">Missing return time</span>
                                  }
                                </div>
                                {dur && (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <ClockIcon className="h-3 w-3 shrink-0" />
                                    <span>Duration: <span className="text-foreground font-medium">{dur}</span></span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {isShared && sharedWithIds.length > 0 && (
                            <div className="basis-full ps-5 text-[11px] text-muted-foreground">
                              Shared with:{" "}
                              {sharedWithIds.map((otherId, index) => (
                                <span key={otherId}>
                                  <button
                                    type="button"
                                    className="underline decoration-dotted underline-offset-2 text-foreground hover:text-primary transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onHighlightIssues?.(idsToHighlight);
                                      const el = document.querySelector<HTMLElement>(`[data-issue-id="${otherId}"]`);
                                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                                    }}
                                  >
                                    {issueTitleById?.get(otherId) ?? `Issue #${otherId}`}
                                  </button>
                                  {index < sharedWithIds.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </div>
                          )}
                          <EntityNotesAttachments
                            entityPath={entityPaths.attendance(storeId, ticketId, item.id)}
                            notes={item.notes}
                            attachments={item.attachments}
                            onSuccess={onReload}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {issue.partUsages.length > 0 && <hr className="border-border" />}
                {issue.partUsages.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Part Usage</p>
                    {issue.partUsages.map((item) => {
                      const sharedWithIds = (sharedPartIssueIdsByRecordId?.get(item.id) ?? [])
                        .filter((id) => id !== issue.id);
                      const isShared = Boolean(sharedPartIds?.has(item.id));
                      const idsToHighlight = [issue.id, ...sharedWithIds];
                      return (
                        <div key={item.id} className={cn("text-xs rounded border px-2 py-1.5", item.mistaken && "opacity-60 line-through")}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Package className="h-3 w-3" />
                            <span>{item.part?.name || `Part #${item.partId}`}</span>
                            <span className="font-medium">${item.cost.toFixed(2)}</span>
                            {item.mistaken && <span className="rounded-full border px-1.5 py-px text-[10px]">mistaken</span>}
                            {!item.mistaken && (
                              <button
                                type="button"
                                className="text-[10px] text-destructive/70 hover:text-destructive transition-colors disabled:pointer-events-none"
                                disabled={mistakenSaving !== null}
                                onClick={async () => {
                                  setMistakenSaving(`part:${item.id}`);
                                  try { await maintenanceTicketsService.markPartUsageMistaken(storeId, ticketId, item.id); onReload(); }
                                  catch { /* noop */ }
                                  finally { setMistakenSaving(null); }
                                }}
                              >
                                {mistakenSaving === `part:${item.id}` ? "…" : "Mark mistaken"}
                              </button>
                            )}
                            {item.createdBy != null && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <User className="h-2.5 w-2.5" />#{item.createdBy}
                              </span>
                            )}
                            {isShared && (
                              <span className="ms-auto rounded-full bg-blue-500/10 px-1.5 py-px text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                Shared action
                              </span>
                            )}
                            {isShared && sharedWithIds.length > 0 && (
                              <div className="basis-full ps-5 text-[11px] text-muted-foreground">
                                Shared with:{" "}
                                {sharedWithIds.map((otherId, index) => (
                                  <span key={otherId}>
                                    <button
                                      type="button"
                                      className="underline decoration-dotted underline-offset-2 text-foreground hover:text-primary transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onHighlightIssues?.(idsToHighlight);
                                        const el = document.querySelector<HTMLElement>(`[data-issue-id="${otherId}"]`);
                                        el?.scrollIntoView({ behavior: "smooth", block: "center" });
                                      }}
                                    >
                                      {issueTitleById?.get(otherId) ?? `Issue #${otherId}`}
                                    </button>
                                    {index < sharedWithIds.length - 1 ? ", " : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {item.attachments.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {item.attachments.map((attachment, index) => {
                                const hasUrl = Boolean(attachment.url);
                                const attachmentLabel = attachment.fileName || `Attachment ${index + 1}`;
                                const mimeType = (attachment.contentType || "").toLowerCase();
                                const lowerUrl = (attachment.url || "").toLowerCase();
                                const lowerFileName = (attachment.fileName || "").toLowerCase();
                                const isImage =
                                  mimeType.startsWith("image/") ||
                                  /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerUrl) ||
                                  /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerFileName);
                                if (!hasUrl) {
                                  return (
                                    <span key={attachment.id} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/40" title={`${attachmentLabel} (missing URL)`}>
                                      <Paperclip className="h-3 w-3" /><span>{attachmentLabel}</span>
                                    </span>
                                  );
                                }
                                if (isImage) {
                                  return (
                                    <a key={attachment.id} href={attachment.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center" title={attachmentLabel} aria-label={`Open ${attachmentLabel} in new tab`}>
                                      <img src={attachment.url} alt={attachmentLabel} className="h-16 w-16 rounded-sm border object-cover" loading="lazy" />
                                    </a>
                                  );
                                }
                                return (
                                  <a key={attachment.id} href={attachment.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground" title={attachmentLabel} aria-label={`Open ${attachmentLabel} in new tab`}>
                                    <Paperclip className="h-3 w-3" /><span>{attachmentLabel}</span>
                                  </a>
                                );
                              })}
                            </div>
                          )}
                          <EntityNotesAttachments
                            entityPath={entityPaths.partUsage(storeId, ticketId, item.id)}
                            notes={item.notes}
                            attachments={[]}
                            onSuccess={onReload}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {issue.payEntries.length > 0 && <hr className="border-border" />}
                {issue.payEntries.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pay Entries</p>
                    {issue.payEntries.map((item) => {
                      const sharedWithIds = (sharedPayIssueIdsByRecordId?.get(item.id) ?? [])
                        .filter((id) => id !== issue.id);
                      const isShared = Boolean(sharedPayIds?.has(item.id));
                      const idsToHighlight = [issue.id, ...sharedWithIds];
                      return (
                        <div key={item.id} className={cn("text-xs rounded border px-2 py-1.5 space-y-1", item.mistaken && "opacity-60 line-through")}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Wallet className="h-3 w-3" />
                            <span>{item.technician?.name ?? `Tech #${item.technicianId}`}</span>
                            {item.basePay != null && <span>Base ${item.basePay.toFixed(2)}</span>}
                            {item.performancePay != null && <span>Perf ${item.performancePay.toFixed(2)}</span>}
                            {item.mistaken && <span className="rounded-full border px-1.5 py-px text-[10px]">mistaken</span>}
                            {!item.mistaken && (
                              <button
                                type="button"
                                className="text-[10px] text-destructive/70 hover:text-destructive transition-colors disabled:pointer-events-none"
                                disabled={mistakenSaving !== null}
                                onClick={async () => {
                                  setMistakenSaving(`pay:${item.id}`);
                                  try { await maintenanceTicketsService.markPayEntryMistaken(storeId, ticketId, item.id); onReload(); }
                                  catch { /* noop */ }
                                  finally { setMistakenSaving(null); }
                                }}
                              >
                                {mistakenSaving === `pay:${item.id}` ? "…" : "Mark mistaken"}
                              </button>
                            )}
                            {item.createdBy != null && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <User className="h-2.5 w-2.5" />#{item.createdBy}
                              </span>
                            )}
                            {isShared && (
                              <span className="ms-auto rounded-full bg-blue-500/10 px-1.5 py-px text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                Shared action
                              </span>
                            )}
                          </div>
                          {isShared && sharedWithIds.length > 0 && (
                            <div className="ps-5 text-[11px] text-muted-foreground">
                              Shared with:{" "}
                              {sharedWithIds.map((otherId, index) => (
                                <span key={otherId}>
                                  <button
                                    type="button"
                                    className="underline decoration-dotted underline-offset-2 text-foreground hover:text-primary transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onHighlightIssues?.(idsToHighlight);
                                      const el = document.querySelector<HTMLElement>(`[data-issue-id="${otherId}"]`);
                                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                                    }}
                                  >
                                    {issueTitleById?.get(otherId) ?? `Issue #${otherId}`}
                                  </button>
                                  {index < sharedWithIds.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </div>
                          )}
                          <EntityNotesAttachments
                            entityPath={entityPaths.payEntry(storeId, ticketId, item.id)}
                            notes={item.notes}
                            attachments={item.attachments}
                            onSuccess={onReload}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {issue.warranties.length > 0 && <hr className="border-border" />}
                {issue.warranties.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Warranties</p>
                    {issue.warranties.map((item) => {
                      const sharedWithIds = (sharedWarrantyIssueIdsByRecordId?.get(item.id) ?? [])
                        .filter((id) => id !== issue.id);
                      const isShared = Boolean(sharedWarrantyIds?.has(item.id));
                      const idsToHighlight = [issue.id, ...sharedWithIds];
                      return (
                      <div key={item.id} className={cn("text-xs rounded border px-2 py-1.5 space-y-1", item.mistaken && "opacity-60 line-through")}>
                        <div className="flex flex-wrap items-center gap-2">
                          <ShieldCheck className="h-3 w-3" />
                          <span>{item.body || "No notes"}</span>
                          {item.expiryDate && (
                            <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] text-muted-foreground">
                              <CalendarIcon className="h-2.5 w-2.5" />
                              Expires {fmtDate(item.expiryDate)}
                            </span>
                          )}
                          {item.mistaken && <span className="rounded-full border px-1.5 py-px text-[10px]">mistaken</span>}
                          {!item.mistaken && (
                            <button
                              type="button"
                              className="text-[10px] text-destructive/70 hover:text-destructive transition-colors disabled:pointer-events-none"
                              disabled={mistakenSaving !== null}
                              onClick={async () => {
                                setMistakenSaving(`warranty:${item.id}`);
                                try { await maintenanceTicketsService.markWarrantyMistaken(storeId, ticketId, item.id); onReload(); }
                                catch { /* noop */ }
                                finally { setMistakenSaving(null); }
                              }}
                            >
                              {mistakenSaving === `warranty:${item.id}` ? "…" : "Mark mistaken"}
                            </button>
                          )}
                          {item.createdBy != null && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <User className="h-2.5 w-2.5" />#{item.createdBy}
                            </span>
                          )}
                          {isShared && (
                            <span className="ms-auto rounded-full bg-blue-500/10 px-1.5 py-px text-[10px] font-medium text-blue-600 dark:text-blue-400">
                              Shared action
                            </span>
                          )}
                        </div>
                        {isShared && sharedWithIds.length > 0 && (
                          <div className="ps-5 text-[11px] text-muted-foreground">
                            Shared with:{" "}
                            {sharedWithIds.map((otherId, index) => (
                              <span key={otherId}>
                                <button
                                  type="button"
                                  className="underline decoration-dotted underline-offset-2 text-foreground hover:text-primary transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onHighlightIssues?.(idsToHighlight);
                                    const el = document.querySelector<HTMLElement>(`[data-issue-id="${otherId}"]`);
                                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                                  }}
                                >
                                  {issueTitleById?.get(otherId) ?? `Issue #${otherId}`}
                                </button>
                                {index < sharedWithIds.length - 1 ? ", " : ""}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.attachments.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {item.attachments.map((attachment, index) => {
                              const hasUrl = Boolean(attachment.url);
                              const attachmentLabel = attachment.fileName || `Attachment ${index + 1}`;
                              const mimeType = (attachment.contentType || "").toLowerCase();
                              const lowerUrl = (attachment.url || "").toLowerCase();
                              const lowerFileName = (attachment.fileName || "").toLowerCase();
                              const isImage =
                                mimeType.startsWith("image/") ||
                                /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerUrl) ||
                                /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerFileName);
                              if (!hasUrl) {
                                return (
                                  <span key={attachment.id} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/40" title={`${attachmentLabel} (missing URL)`}>
                                    <Paperclip className="h-3 w-3" /><span>{attachmentLabel}</span>
                                  </span>
                                );
                              }
                              if (isImage) {
                                return (
                                  <a key={attachment.id} href={attachment.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center" title={attachmentLabel} aria-label={`Open ${attachmentLabel} in new tab`}>
                                    <img src={attachment.url} alt={attachmentLabel} className="h-16 w-16 rounded-sm border object-cover" loading="lazy" />
                                  </a>
                                );
                              }
                              return (
                                <a key={attachment.id} href={attachment.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground" title={attachmentLabel} aria-label={`Open ${attachmentLabel} in new tab`}>
                                  <Paperclip className="h-3 w-3" /><span>{attachmentLabel}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}
                        <EntityNotesAttachments
                          entityPath={entityPaths.warranty(storeId, ticketId, item.id)}
                          notes={item.notes}
                          attachments={[]}
                          onSuccess={onReload}
                        />
                      </div>
                      );
                    })}
                  </div>
                )}

                <hr className="border-border" />
                {/* Action menu */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Issue actions</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8">
                        <MoreHorizontal className="h-4 w-4 me-1" />
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => toggleAction("status")}>
                        <FileText className="h-4 w-4" />
                        Change status
                      </DropdownMenuItem>
                      {canAssign && (
                        <DropdownMenuItem onClick={() => toggleAction("assign")}>
                          <UserRoundPlus className="h-4 w-4" />
                          Assign issue
                        </DropdownMenuItem>
                      )}
                      {canDefer && (
                        <DropdownMenuItem onClick={() => toggleAction("defer")}>
                          <TimerReset className="h-4 w-4" />
                          Defer issue
                        </DropdownMenuItem>
                      )}
                      {canCancel && (
                        <DropdownMenuItem onClick={() => toggleAction("cancel")} className="text-destructive focus:text-destructive">
                          <X className="h-4 w-4" />
                          Cancel issue
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => toggleAction("diagnosis")}><FileText className="h-4 w-4" />Add diagnosis</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleAction("attendance")}><Wrench className="h-4 w-4" />Add attendance</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleAction("part")}><Package className="h-4 w-4" />Add part usage</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleAction("pay")}><Wallet className="h-4 w-4" />Add pay entry</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleAction("warranty")}><ShieldCheck className="h-4 w-4" />Add warranty</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleAction("attachTechs")}><Users2 className="h-4 w-4" />Attach technicians</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleAction("delayAssignment")}><TimerReset className="h-4 w-4" />Delay assignment</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleAction("changeTechs")}><Users2 className="h-4 w-4" />Change technicians</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Inline action panels */}
                {activeAction === "status" && (
                  <ChangeStatusPanel issue={issue} storeId={storeId} ticketId={ticketId}
                    onClose={() => setActiveAction(null)} onSuccess={onReload} />
                )}
                {activeAction === "assign" && (
                  <AssignPanel issue={issue} storeId={storeId} ticketId={ticketId}
                    technicians={technicians} issueDraft={issueDraft} onPatchDraft={onPatchDraft}
                    onClose={() => setActiveAction(null)} onSuccess={onReload} />
                )}
                {activeAction === "defer" && (
                  <DeferPanel issue={issue} storeId={storeId} ticketId={ticketId}
                    issueDraft={issueDraft} onPatchDraft={onPatchDraft}
                    onClose={() => setActiveAction(null)} onSuccess={onReload} />
                )}
                {activeAction === "cancel" && (
                  <CancelPanel issue={issue} storeId={storeId} ticketId={ticketId}
                    issueDraft={issueDraft} onPatchDraft={onPatchDraft}
                    onClose={() => setActiveAction(null)} onSuccess={onReload} />
                )}
                {activeAction === "diagnosis" && (
                  <DiagnosisPanel issue={issue} storeId={storeId} ticketId={ticketId}
                    issueDraft={issueDraft} onPatchDraft={onPatchDraft} onClearDraftFields={onClearDraftFields}
                    onClose={() => setActiveAction(null)} onSuccess={onReload} />
                )}
                {activeAction === "attendance" && (
                  <AttendancePanel issue={issue} storeId={storeId} ticketId={ticketId}
                    technicians={technicians.filter((t) => issue.technicians.some((at) => at.id === t.id))}
                    issueDraft={issueDraft} onPatchDraft={onPatchDraft} onClearDraftFields={onClearDraftFields}
                    onClose={() => setActiveAction(null)} onSuccess={onReload} />
                )}
                {activeAction === "part" && (
                  <PartUsagePanel issue={issue} storeId={storeId} ticketId={ticketId}
                    issueDraft={issueDraft} onPatchDraft={onPatchDraft} onClearDraftFields={onClearDraftFields}
                    onClose={() => setActiveAction(null)} onSuccess={onReload} />
                )}
                {activeAction === "pay" && (
                  <PayEntryPanel issue={issue} storeId={storeId} ticketId={ticketId}
                    technicians={technicians}
                    issueDraft={issueDraft} onPatchDraft={onPatchDraft} onClearDraftFields={onClearDraftFields}
                    onClose={() => setActiveAction(null)} onSuccess={onReload} />
                )}
                {activeAction === "warranty" && (
                  <WarrantyPanel issue={issue} storeId={storeId} ticketId={ticketId}
                    issueDraft={issueDraft} onPatchDraft={onPatchDraft} onClearDraftFields={onClearDraftFields}
                    onClose={() => setActiveAction(null)} onSuccess={onReload} />
                )}
                {activeAction === "attachTechs" && (
                  <AttachTechsPanel issue={issue} storeId={storeId} ticketId={ticketId}
                    technicians={technicians}
                    issueDraft={issueDraft} onPatchDraft={onPatchDraft} onClearDraftFields={onClearDraftFields}
                    onClose={() => setActiveAction(null)} onSuccess={onReload} />
                )}
                {activeAction === "delayAssignment" && (
                  <DelayAssignmentPanel issue={issue} storeId={storeId} ticketId={ticketId}
                    issueDraft={issueDraft} onPatchDraft={onPatchDraft} onClearDraftFields={onClearDraftFields}
                    onClose={() => setActiveAction(null)} onSuccess={onReload} />
                )}
                {activeAction === "changeTechs" && (
                  <ChangeTechsPanel issue={issue} storeId={storeId} ticketId={ticketId}
                    technicians={technicians}
                    issueDraft={issueDraft} onPatchDraft={onPatchDraft} onClearDraftFields={onClearDraftFields}
                    onClose={() => setActiveAction(null)} onSuccess={onReload} />
                )}

                {/* Issue-level notes & attachments */}
                <EntityNotesAttachments
                  entityPath={entityPaths.ticketIssue(storeId, ticketId, issue.id)}
                  notes={issue.notes}
                  attachments={issue.attachments}
                  onSuccess={onReload}
                  allowNoteType
                />

                {/* Status history */}
                {issue.statusChanges.length > 0 && <StatusHistory changes={issue.statusChanges} />}
              </div>
            )}
          </div>


        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Mobile ticket pill switcher (< md)                                     */
/* ────────────────────────────────────────────────────────────────────────── */

interface MobileSwitcherProps {
  tickets: Ticket[];
  activeId: number | null;
  onSelect: (id: number) => void;
}

function MobileTicketSwitcher({ tickets, activeId, onSelect }: MobileSwitcherProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !activeId) return;
    const btn = containerRef.current.querySelector(`[data-ticket-id="${activeId}"]`) as HTMLElement | null;
    btn?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId]);

  return (
    <div className="md:hidden shrink-0 border-b bg-muted/10">
      <div ref={containerRef} className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none">
        {tickets.map((ticket) => (
          <button
            key={ticket.id}
            data-ticket-id={ticket.id}
            type="button"
            onClick={() => onSelect(ticket.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
              ticket.id === activeId
                ? "bg-foreground text-background border-foreground"
                : "text-muted-foreground hover:text-foreground hover:border-foreground/40"
            )}
          >
            #{ticket.id}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Right content panel                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

interface RightPanelProps {
  activeTicketId: number | null;
  tickets: Ticket[];
  storeId: string;
  technicians: CatalogTechnician[];
  issuesResponse: TicketIssuesResponse | null;
  isLoading: boolean;
  loadError: string | null;
  onRefresh: () => void;
  draft: ReturnType<typeof useTicketDraft>;
}

function RightPanel({
  activeTicketId,
  tickets,
  storeId,
  technicians,
  issuesResponse,
  isLoading,
  loadError,
  onRefresh,
  draft,
}: RightPanelProps) {
  const t = useTranslations("maintenanceTickets");
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<number>>(new Set());
  const [highlightedIssueIds, setHighlightedIssueIds] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState<"none" | "status" | "priority" | "technician" | "part" | "assigned_technician" | "pay" | "warranty" | "diagnosis">("none");
  const [closingNotesOpen, setClosingNotesOpen] = useState(false);
  const [composingNoteType, setComposingNoteType] = useState<NoteType | null>(null);
  const [closingBody, setClosingBody] = useState("");
  const [closingFiles, setClosingFiles] = useState<File[]>([]);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  /** Local override of ticket notes/attachments (the ticket object isn't refetched here). */
  const [ticketNotes, setTicketNotes] = useState<TicketNote[] | null>(null);
  const [ticketAttachments, setTicketAttachments] = useState<TicketAttachment[] | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  // Clear selection + local ticket-notes override when ticket changes
  useEffect(() => {
    setSelectedIssueIds(new Set());
    setHighlightedIssueIds(new Set());
    setTicketNotes(null);
    setTicketAttachments(null);
    setComposingNoteType(null);
    setClosingBody("");
    setClosingFiles([]);
    setClosingNotesOpen(false);
  }, [activeTicketId]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current != null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  function toggleIssueSelect(id: number) {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function triggerIssueHighlight(ids: number[]) {
    const unique = Array.from(new Set(ids));
    setHighlightedIssueIds(new Set(unique));
    if (highlightTimeoutRef.current != null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedIssueIds(new Set());
      highlightTimeoutRef.current = null;
    }, 1200);
  }

  const activeTicket = tickets.find((tk) => tk.id === activeTicketId);
  const effectiveNotes = ticketNotes ?? activeTicket?.notes ?? [];
  const effectiveAttachments = ticketAttachments ?? activeTicket?.attachments ?? [];
  const isClosingType = (t: string | null) => t === "final_notes" || t === "what_we_learned";
  const closingNotes = effectiveNotes.filter((n) => isClosingType(n.type));
  const genericTicketNotes = effectiveNotes.filter((n) => !isClosingType(n.type));

  async function handleAddClosingNote() {
    if (!activeTicketId || !composingNoteType) return;
    if (!closingBody.trim()) { setNoteError("Note text is required."); return; }
    setIsSubmittingNote(true); setNoteError(null);
    try {
      const updated = await maintenanceTicketsService.addFinalNote(
        storeId,
        activeTicketId,
        { body: closingBody.trim(), type: composingNoteType },
        closingFiles,
      );
      setTicketNotes(updated.notes);
      setTicketAttachments(updated.attachments);
      setComposingNoteType(null);
      setClosingBody("");
      setClosingFiles([]);
    } catch (err) {
      setNoteError(err instanceof MaintenanceTicketsError ? err.message : t("detailSheet.actionError"));
    } finally { setIsSubmittingNote(false); }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sticky header */}
      <header className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-b flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <SheetTitle className="text-lg font-semibold leading-none">
                {activeTicketId ? `${t("detailSheet.title")} #${activeTicketId}` : t("detailSheet.title")}
              </SheetTitle>
            </div>
            {activeTicket && <StatusChip label={activeTicket.status.label} />}
          </div>
          {activeTicket && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Store className="h-3.5 w-3.5" />
              <span>{activeTicket.storeId}</span>
              {activeTicket.issueCount > 0 && (
                <>
                  <span>·</span>
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span> {t("navigator.issueCount", { count: activeTicket.issueCount })}</span>
                </>
              )}
            </div>
          )}
          <SheetDescription className="sr-only">{t("detailSheet.description")}</SheetDescription>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 flex-wrap justify-end">
          {/* Group-by selector */}
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className={cn(
              "h-8 w-auto gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
              "focus:ring-0 focus:ring-offset-0",
              groupBy !== "none"
                ? "border-primary/40 bg-primary/5 text-primary"
                : "border-border bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              "[&>svg:last-child]:h-3 [&>svg:last-child]:w-3 [&>svg:last-child]:shrink-0"
            )}>
              <LayoutList className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{t("groupBy.label")}:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              position="popper"
              side="bottom"
              align="end"
              sideOffset={6}
              className="max-h-64 overflow-y-auto"
            >
              <SelectItem value="none">{t("groupBy.none")}</SelectItem>
              <SelectItem value="status">{t("groupBy.status")}</SelectItem>
              <SelectItem value="priority">{t("groupBy.priority")}</SelectItem>
              <SelectItem value="assigned_technician">{t("groupBy.assigned_technician")}</SelectItem>
              <SelectItem value="technician">{t("groupBy.technician")}</SelectItem>
              <SelectItem value="part">{t("groupBy.part")}</SelectItem>
              <SelectItem value="pay">{t("groupBy.pay")}</SelectItem>
              <SelectItem value="warranty">{t("groupBy.warranty")}</SelectItem>
              <SelectItem value="diagnosis">{t("groupBy.diagnosis")}</SelectItem>
            </SelectContent>
          </Select>
          {issuesResponse && issuesResponse.data.length > 0 && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground"
                onClick={() => setSelectedIssueIds(new Set(issuesResponse.data.map((i) => i.id)))}>
                <ListChecks className="me-1 h-3.5 w-3.5" />Select all
              </Button>
              {selectedIssueIds.size > 0 && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground"
                  onClick={() => setSelectedIssueIds(new Set())}>
                  Clear
                </Button>
              )}
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh}
            disabled={isLoading} aria-label={t("refresh")}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </header>

      {/* Scrollable issue body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 sm:py-5">
        {/* Closing notes & ticket-level notes/files */}
        {activeTicketId && !loadError && (
          <div className="mb-5 rounded-lg border bg-muted/10 overflow-hidden">
            {/* Collapsible header */}
            <button
              type="button"
              onClick={() => setClosingNotesOpen((v) => !v)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/20 transition-colors"
            >
              {closingNotesOpen
                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">
                Closing notes
              </span>
              {closingNotes.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-px text-[9px] font-medium">
                  {closingNotes.length}
                </span>
              )}
            </button>

            {closingNotesOpen && (
              <div className="border-t px-3 pb-3 pt-2 space-y-3">
                {/* Add buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => { setComposingNoteType("final_notes"); setClosingBody(""); setClosingFiles([]); setNoteError(null); }}>
                    <Plus className="me-1 h-3 w-3" /> Final Note
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => { setComposingNoteType("what_we_learned"); setClosingBody(""); setClosingFiles([]); setNoteError(null); }}>
                    <Plus className="me-1 h-3 w-3" /> What We Learned
                  </Button>
                </div>

                {closingNotes.length > 0
                  ? <NotesList notes={closingNotes} />
                  : <p className="text-xs text-muted-foreground/60 italic">No closing notes yet.</p>}

                {composingNoteType && (
                  <div className="rounded-md border bg-background p-2 space-y-2">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {composingNoteType === "final_notes" ? "Add Final Note" : "Add What We Learned"}
                    </p>
                    <Textarea className="text-sm resize-none min-h-20" placeholder="Write the note…"
                      value={closingBody} onChange={(e) => setClosingBody(e.target.value)} />
                    <Input type="file" multiple className="h-8 text-xs"
                      onChange={(e) => setClosingFiles(Array.from(e.target.files ?? []))} />
                    {noteError && <p className="text-xs text-destructive">{noteError}</p>}
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setComposingNoteType(null); setNoteError(null); }} disabled={isSubmittingNote}>
                        {t("common.cancel")}
                      </Button>
                      <Button size="sm" onClick={handleAddClosingNote} disabled={isSubmittingNote || !closingBody.trim()}>
                        {isSubmittingNote && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}
                        {t("common.save")}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Generic ticket-level notes & files */}
                <EntityNotesAttachments
                  entityPath={entityPaths.ticket(storeId, activeTicketId)}
                  notes={genericTicketNotes}
                  attachments={effectiveAttachments}
                  onSuccess={() => {}}
                  onNoteAdded={(note) => setTicketNotes((prev) => [...(prev ?? activeTicket?.notes ?? []), note])}
                  onAttachmentsAdded={(atts) => setTicketAttachments((prev) => [...(prev ?? activeTicket?.attachments ?? []), ...atts])}
                  allowNoteType
                />
              </div>
            )}
          </div>
        )}

        {/* Skeleton — show whenever loading, covers first-load AND ticket-switch */}
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-5 w-5 rounded-full mt-0.5 shrink-0" />
                <div className="flex-1 rounded-lg border p-4 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && loadError && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/70" />
            <p className="text-sm font-medium text-destructive">
              {activeTicketId ? `Failed to load ticket #${activeTicketId}` : "Failed to load ticket"}
            </p>
            <p className="text-xs text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={onRefresh}>{t("error.retry")}</Button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !loadError && issuesResponse?.data.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Circle className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t("detailSheet.noIssues")}</p>
          </div>
        )}

        {/* Issues tree */}
        {!isLoading && !loadError && issuesResponse && issuesResponse.data.length > 0 && (() => {
          // ── Compute shared action record IDs (used by both grouped and flat views) ──
          // A record ID is "shared" when it appears on more than one issue.
          const partIssueIdsByRecordId = new Map<number, number[]>();
          const attendanceIssueIdsByRecordId = new Map<number, number[]>();
          const payIssueIdsByRecordId = new Map<number, number[]>();
          const warrantyIssueIdsByRecordId = new Map<number, number[]>();
          const diagnosisIssueIdsByRecordId = new Map<number, number[]>();
          const issueTitleById = new Map<number, string>();
          for (const iss of issuesResponse.data) {
            issueTitleById.set(iss.id, iss.issueTitle ?? iss.otherTitle ?? `Issue #${iss.id}`);
            for (const pu of iss.partUsages) {
              if (!partIssueIdsByRecordId.has(pu.id)) partIssueIdsByRecordId.set(pu.id, []);
              const arr = partIssueIdsByRecordId.get(pu.id)!;
              if (!arr.includes(iss.id)) arr.push(iss.id);
            }
            for (const ae of iss.attendanceEntries) {
              if (!attendanceIssueIdsByRecordId.has(ae.id)) attendanceIssueIdsByRecordId.set(ae.id, []);
              const arr = attendanceIssueIdsByRecordId.get(ae.id)!;
              if (!arr.includes(iss.id)) arr.push(iss.id);
            }
            for (const pe of iss.payEntries) {
              if (!payIssueIdsByRecordId.has(pe.id)) payIssueIdsByRecordId.set(pe.id, []);
              const arr = payIssueIdsByRecordId.get(pe.id)!;
              if (!arr.includes(iss.id)) arr.push(iss.id);
            }
            for (const w of iss.warranties) {
              if (!warrantyIssueIdsByRecordId.has(w.id)) warrantyIssueIdsByRecordId.set(w.id, []);
              const arr = warrantyIssueIdsByRecordId.get(w.id)!;
              if (!arr.includes(iss.id)) arr.push(iss.id);
            }
            for (const d of iss.diagnoses) {
              if (!diagnosisIssueIdsByRecordId.has(d.id)) diagnosisIssueIdsByRecordId.set(d.id, []);
              const arr = diagnosisIssueIdsByRecordId.get(d.id)!;
              if (!arr.includes(iss.id)) arr.push(iss.id);
            }
          }
          const sharedPartIds: ReadonlySet<number> = new Set(
            [...partIssueIdsByRecordId.entries()].filter(([, issueIds]) => issueIds.length > 1).map(([id]) => id)
          );
          const sharedAttendanceIds: ReadonlySet<number> = new Set(
            [...attendanceIssueIdsByRecordId.entries()].filter(([, issueIds]) => issueIds.length > 1).map(([id]) => id)
          );
          const sharedPayIds: ReadonlySet<number> = new Set(
            [...payIssueIdsByRecordId.entries()].filter(([, issueIds]) => issueIds.length > 1).map(([id]) => id)
          );
          const sharedWarrantyIds: ReadonlySet<number> = new Set(
            [...warrantyIssueIdsByRecordId.entries()].filter(([, issueIds]) => issueIds.length > 1).map(([id]) => id)
          );
          const sharedDiagnosisIds: ReadonlySet<number> = new Set(
            [...diagnosisIssueIdsByRecordId.entries()].filter(([, issueIds]) => issueIds.length > 1).map(([id]) => id)
          );
          const bulkAttendanceTechnicians = technicians.filter((t) =>
            issuesResponse.data
              .filter((i) => selectedIssueIds.has(i.id))
              .flatMap((i) => i.technicians)
              .some((at) => at.id === t.id)
          );
          return (
          <div>
            {/* Bulk action bar — visible when ≥2 issues selected */}
            {selectedIssueIds.size > 1 && (
              <BulkActionBar
                issueIds={Array.from(selectedIssueIds)}
                storeId={storeId}
                ticketId={activeTicketId!}
                technicians={technicians}
                attendanceTechnicians={bulkAttendanceTechnicians}
                onClear={() => setSelectedIssueIds(new Set())}
                onSuccess={() => {
                  setSelectedIssueIds(new Set());
                  onRefresh();
                }}
              />
            )}
            {/* ── Group-by section headers ─────────────────────────────── */}
            {groupBy !== "none" && (() => {
              // ── Build groups ────────────────────────────────────────────
              // status/priority: keyed by attribute label (unchanged)
              // part:            keyed by part_usage.id  (same record = truly shared)
              // technician:      keyed by attendance_entry.id (same record = truly shared)
              const orderedKeys: string[] = [];
              const groupedIssues = new Map<string, TicketIssue[]>();
              // Human-readable label per group key
              const keyLabel = new Map<string, string>();

              const addToGroup = (key: string, label: string, iss: TicketIssue) => {
                if (!groupedIssues.has(key)) {
                  groupedIssues.set(key, []);
                  orderedKeys.push(key);
                  keyLabel.set(key, label);
                }
                // Deduplicate by issue ID in case of repeated calls
                const arr = groupedIssues.get(key)!;
                if (!arr.some((i) => i.id === iss.id)) arr.push(iss);
              };

              for (const iss of issuesResponse.data) {
                if (groupBy === "status") {
                  addToGroup(iss.status.label, iss.status.label, iss);
                } else if (groupBy === "priority") {
                  addToGroup(iss.priority.label, iss.priority.label, iss);
                } else if (groupBy === "part") {
                  if (iss.partUsages.length === 0) {
                    addToGroup("__no-parts__", "No parts", iss);
                  } else {
                    for (const pu of iss.partUsages) {
                      const lbl = pu.part?.name ?? `Part #${pu.partId}`;
                      addToGroup(`part-record-${pu.id}`, lbl, iss);
                    }
                  }
                } else if (groupBy === "technician") {
                  if (iss.attendanceEntries.length === 0) {
                    addToGroup("__no-attendance__", "No attendance", iss);
                  } else {
                    for (const ae of iss.attendanceEntries) {
                      const tech = technicians.find((tc) => tc.id === ae.technicianId);
                      const lbl = ae.technician?.name ?? tech?.name ?? `Technician #${ae.technicianId}`;
                      addToGroup(`attendance-record-${ae.id}`, lbl, iss);
                    }
                  }
                } else if (groupBy === "assigned_technician") {
                  if (iss.technicians.length === 0) {
                    addToGroup("__no-assigned-tech__", "No assigned technician", iss);
                  } else {
                    for (const tech of iss.technicians) {
                      addToGroup(`assigned-tech-${tech.id}`, tech.name, iss);
                    }
                  }
                } else if (groupBy === "pay") {
                  if (iss.payEntries.length === 0) {
                    addToGroup("__no-pay__", "No pay entries", iss);
                  } else {
                    for (const pe of iss.payEntries) {
                      const tech = technicians.find((tc) => tc.id === pe.technicianId);
                      const lbl = tech?.name ?? `Technician #${pe.technicianId}`;
                      addToGroup(`pay-record-${pe.id}`, lbl, iss);
                    }
                  }
                } else if (groupBy === "warranty") {
                  if (iss.warranties.length === 0) {
                    addToGroup("__no-warranty__", "No warranty", iss);
                  } else {
                    for (const w of iss.warranties) {
                      addToGroup(`warranty-record-${w.id}`, w.body ? w.body.slice(0, 40) : `Warranty #${w.id}`, iss);
                    }
                  }
                } else if (groupBy === "diagnosis") {
                  if (iss.diagnoses.length === 0) {
                    addToGroup("__no-diagnosis__", "No diagnosis", iss);
                  } else {
                    for (const d of iss.diagnoses) {
                      addToGroup(`diagnosis-record-${d.id}`, d.body ? d.body.slice(0, 40) : `Diagnosis #${d.id}`, iss);
                    }
                  }
                }
              }

              // ── Subtitle & action-kind per group ────────────────────────
              const getGroupMeta = (
                key: string,
                issues: TicketIssue[]
              ): { subtitle: string; actionKind: "shared" | "solo" | null } => {
                const isShared = issues.length > 1;
                if (groupBy === "part") {
                  if (key === "__no-parts__")
                    return { subtitle: "These issues have no parts added", actionKind: null };
                  return {
                    subtitle: isShared
                      ? "Note: this part action was created one time and shared across the following issues"
                      : "Note: this part action applies only to this issue",
                    actionKind: isShared ? "shared" : "solo",
                  };
                }
                if (groupBy === "technician") {
                  if (key === "__no-attendance__")
                    return { subtitle: "These issues have no attendance records", actionKind: null };
                  return {
                    subtitle: isShared
                      ? "Note: this attendance action (same time record) was applied to the following issues"
                      : "Note: this attendance action applies only to this issue",
                    actionKind: isShared ? "shared" : "solo",
                  };
                }
                if (groupBy === "pay") {
                  if (key === "__no-pay__")
                    return { subtitle: "These issues have no pay entries", actionKind: null };
                  return {
                    subtitle: isShared
                      ? "Note: this pay entry was applied to the following issues"
                      : "Note: this pay entry applies only to this issue",
                    actionKind: isShared ? "shared" : "solo",
                  };
                }
                if (groupBy === "warranty") {
                  if (key === "__no-warranty__")
                    return { subtitle: "These issues have no warranty claims", actionKind: null };
                  return {
                    subtitle: isShared
                      ? "Note: this warranty record was shared across the following issues"
                      : "Note: this warranty applies only to this issue",
                    actionKind: isShared ? "shared" : "solo",
                  };
                }
                if (groupBy === "diagnosis") {
                  if (key === "__no-diagnosis__")
                    return { subtitle: "These issues have no diagnosis records", actionKind: null };
                  return {
                    subtitle: isShared
                      ? "Note: this diagnosis was shared across the following issues"
                      : "Note: this diagnosis applies only to this issue",
                    actionKind: isShared ? "shared" : "solo",
                  };
                }
                if (groupBy === "assigned_technician") {
                  if (key === "__no-assigned-tech__")
                    return { subtitle: "These issues have no assigned technician", actionKind: null };
                  return { subtitle: `Issues assigned to: ${keyLabel.get(key) ?? key}`, actionKind: null };
                }
                if (groupBy === "status")
                  return { subtitle: `These issues share the same status: ${keyLabel.get(key) ?? key}`, actionKind: null };
                if (groupBy === "priority")
                  return { subtitle: `These issues share the same priority: ${keyLabel.get(key) ?? key}`, actionKind: null };
                return { subtitle: "", actionKind: null };
              };

              // Within each group render the same flat-sibling layout as no-grouping:
              // group-root = issue whose parent is absent from this group
              // all descendants rendered as flat siblings with T/L connectors
              const renderGroupContent = (issues: TicketIssue[]) => {
                const inGroup = new Set(issues.map((i) => i.id));
                const childToGroupRoot = new Map<number, number>();
                const groupRootOrder: number[] = [];
                const gMap = new Map<number, { root: TicketIssue; descendants: TicketIssue[] }>();
                for (const iss of issues) {
                  const isGroupRoot = iss.parentId == null || !inGroup.has(iss.parentId);
                  if (isGroupRoot) {
                    childToGroupRoot.set(iss.id, iss.id);
                    gMap.set(iss.id, { root: iss, descendants: [] });
                    groupRootOrder.push(iss.id);
                  } else {
                    const rootId = childToGroupRoot.get(iss.parentId!) ?? iss.id;
                    childToGroupRoot.set(iss.id, rootId);
                    gMap.get(rootId)?.descendants.push(iss);
                  }
                }
                return groupRootOrder.map((rootId) => {
                  const grp = gMap.get(rootId)!;
                  return (
                    <div key={rootId} className="mb-1">
                      <IssueNode
                        issue={grp.root}
                        storeId={storeId}
                        ticketId={activeTicketId!}
                        technicians={technicians}
                        isExpanded={draft.isIssueExpanded(grp.root.id)}
                        onToggleExpand={() => draft.toggleIssueExpanded(grp.root.id)}
                        issueDraft={draft.getIssueDraft(grp.root.id)}
                        onPatchDraft={(patch) => draft.patchIssueDraft(grp.root.id, patch)}
                        onClearDraftFields={(keys) => draft.clearIssueDraftFields(grp.root.id, keys)}
                        onReload={onRefresh}
                        depth={0}
                        isLast={grp.descendants.length === 0}
                        isSelectMode={true}
                        selectedIssueIds={selectedIssueIds}
                        onToggleSelectId={toggleIssueSelect}
                        sharedPartIds={sharedPartIds}
                        sharedAttendanceIds={sharedAttendanceIds}
                        sharedPayIds={sharedPayIds}
                        sharedWarrantyIds={sharedWarrantyIds}
                        sharedDiagnosisIds={sharedDiagnosisIds}
                        sharedPartIssueIdsByRecordId={partIssueIdsByRecordId}
                        sharedAttendanceIssueIdsByRecordId={attendanceIssueIdsByRecordId}
                        sharedPayIssueIdsByRecordId={payIssueIdsByRecordId}
                        sharedWarrantyIssueIdsByRecordId={warrantyIssueIdsByRecordId}
                        sharedDiagnosisIssueIdsByRecordId={diagnosisIssueIdsByRecordId}
                        issueTitleById={issueTitleById}
                        onHighlightIssues={triggerIssueHighlight}
                        showSharedIndicatorWhenCollapsed={false}
                        isHighlighted={highlightedIssueIds.has(grp.root.id)}
                      />
                      {grp.descendants.length > 0 && (
                        <div className="ms-[9px]">
                          {grp.descendants.map((desc, di) => (
                            <div key={desc.id} className="relative ps-5">
                              <div className={cn("absolute start-0 w-px bg-border", di === grp.descendants.length - 1 ? "top-0 h-3" : "top-0 bottom-0")} />
                              <div className="absolute start-0 top-3 h-px w-5 bg-border" />
                              <IssueNode
                                issue={desc}
                                storeId={storeId}
                                ticketId={activeTicketId!}
                                technicians={technicians}
                                isExpanded={draft.isIssueExpanded(desc.id)}
                                onToggleExpand={() => draft.toggleIssueExpanded(desc.id)}
                                issueDraft={draft.getIssueDraft(desc.id)}
                                onPatchDraft={(patch) => draft.patchIssueDraft(desc.id, patch)}
                                onClearDraftFields={(keys) => draft.clearIssueDraftFields(desc.id, keys)}
                                onReload={onRefresh}
                                depth={1}
                                isLast={true}
                                isSelectMode={true}
                                selectedIssueIds={selectedIssueIds}
                                onToggleSelectId={toggleIssueSelect}
                                sharedPartIds={sharedPartIds}
                                sharedAttendanceIds={sharedAttendanceIds}
                                sharedPayIds={sharedPayIds}
                                sharedWarrantyIds={sharedWarrantyIds}
                                sharedDiagnosisIds={sharedDiagnosisIds}
                                sharedPartIssueIdsByRecordId={partIssueIdsByRecordId}
                                sharedAttendanceIssueIdsByRecordId={attendanceIssueIdsByRecordId}
                                sharedPayIssueIdsByRecordId={payIssueIdsByRecordId}
                                sharedWarrantyIssueIdsByRecordId={warrantyIssueIdsByRecordId}
                                sharedDiagnosisIssueIdsByRecordId={diagnosisIssueIdsByRecordId}
                                issueTitleById={issueTitleById}
                                onHighlightIssues={triggerIssueHighlight}
                                showSharedIndicatorWhenCollapsed={false}
                                isHighlighted={highlightedIssueIds.has(desc.id)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              };

              return orderedKeys.map((key) => {
                const issues = groupedIssues.get(key)!;
                const { subtitle, actionKind } = getGroupMeta(key, issues);
                return (
                  <GroupSection
                    key={key}
                    label={keyLabel.get(key) ?? key}
                    count={issues.length}
                    subtitle={subtitle}
                    actionKind={actionKind}
                  >
                    {renderGroupContent(issues)}
                  </GroupSection>
                );
              });
            })()}
            {/* ── Default (no grouping) ───────────────────────────────── */}
            {groupBy === "none" && (() => {
              // Map each issue to its root ancestor (list is already topologically sorted)
              const childToRoot = new Map<number, number>();
              for (const iss of issuesResponse.data) {
                if (iss.parentId == null) {
                  childToRoot.set(iss.id, iss.id);
                } else {
                  childToRoot.set(iss.id, childToRoot.get(iss.parentId) ?? iss.id);
                }
              }
              // Build ordered groups: root issue → flat list of all descendants
              const groupMap = new Map<number, { root: TicketIssue; descendants: TicketIssue[] }>();
              const groupOrder: number[] = [];
              for (const iss of issuesResponse.data) {
                if (iss.parentId == null) {
                  groupMap.set(iss.id, { root: iss, descendants: [] });
                  groupOrder.push(iss.id);
                } else {
                  const rootId = childToRoot.get(iss.id)!;
                  groupMap.get(rootId)?.descendants.push(iss);
                }
              }
              return groupOrder.map((rootId) => {
                const group = groupMap.get(rootId)!;
                return (
                  <div key={rootId} className="mb-1">
                    <IssueNode
                      issue={group.root}
                      storeId={storeId}
                      ticketId={activeTicketId!}
                      technicians={technicians}
                      isExpanded={draft.isIssueExpanded(group.root.id)}
                      onToggleExpand={() => draft.toggleIssueExpanded(group.root.id)}
                      issueDraft={draft.getIssueDraft(group.root.id)}
                      onPatchDraft={(patch) => draft.patchIssueDraft(group.root.id, patch)}
                      onClearDraftFields={(keys) => draft.clearIssueDraftFields(group.root.id, keys)}
                      onReload={onRefresh}
                      depth={0}
                      isLast={group.descendants.length === 0}
                      isSelectMode={true}
                      selectedIssueIds={selectedIssueIds}
                      onToggleSelectId={toggleIssueSelect}
                      sharedPartIds={sharedPartIds}
                      sharedAttendanceIds={sharedAttendanceIds}
                      sharedPayIds={sharedPayIds}
                      sharedWarrantyIds={sharedWarrantyIds}
                      sharedDiagnosisIds={sharedDiagnosisIds}
                      sharedPartIssueIdsByRecordId={partIssueIdsByRecordId}
                      sharedAttendanceIssueIdsByRecordId={attendanceIssueIdsByRecordId}
                      sharedPayIssueIdsByRecordId={payIssueIdsByRecordId}
                      sharedWarrantyIssueIdsByRecordId={warrantyIssueIdsByRecordId}
                      sharedDiagnosisIssueIdsByRecordId={diagnosisIssueIdsByRecordId}
                      issueTitleById={issueTitleById}
                      onHighlightIssues={triggerIssueHighlight}
                      showSharedIndicatorWhenCollapsed={true}
                      isHighlighted={highlightedIssueIds.has(group.root.id)}
                    />
                    {group.descendants.length > 0 && (
                      <div className="ms-[9px]">
                        {group.descendants.map((child, ci) => (
                          <div key={child.id} className="relative ps-5">
                            <div className={cn("absolute start-0 w-px bg-border", ci === group.descendants.length - 1 ? "top-0 h-3" : "top-0 bottom-0")} />
                            <div className="absolute start-0 top-3 h-px w-5 bg-border" />
                            <IssueNode
                              issue={child}
                              storeId={storeId}
                              ticketId={activeTicketId!}
                              technicians={technicians}
                              isExpanded={draft.isIssueExpanded(child.id)}
                              onToggleExpand={() => draft.toggleIssueExpanded(child.id)}
                              issueDraft={draft.getIssueDraft(child.id)}
                              onPatchDraft={(patch) => draft.patchIssueDraft(child.id, patch)}
                              onClearDraftFields={(keys) => draft.clearIssueDraftFields(child.id, keys)}
                              onReload={onRefresh}
                              depth={1}
                              isLast={true}
                              isSelectMode={true}
                              selectedIssueIds={selectedIssueIds}
                              onToggleSelectId={toggleIssueSelect}
                              sharedPartIds={sharedPartIds}
                              sharedAttendanceIds={sharedAttendanceIds}
                              sharedPayIds={sharedPayIds}
                              sharedWarrantyIds={sharedWarrantyIds}
                              sharedDiagnosisIds={sharedDiagnosisIds}
                              sharedPartIssueIdsByRecordId={partIssueIdsByRecordId}
                              sharedAttendanceIssueIdsByRecordId={attendanceIssueIdsByRecordId}
                              sharedPayIssueIdsByRecordId={payIssueIdsByRecordId}
                              sharedWarrantyIssueIdsByRecordId={warrantyIssueIdsByRecordId}
                              sharedDiagnosisIssueIdsByRecordId={diagnosisIssueIdsByRecordId}
                              issueTitleById={issueTitleById}
                              onHighlightIssues={triggerIssueHighlight}
                              showSharedIndicatorWhenCollapsed={true}
                              isHighlighted={highlightedIssueIds.has(child.id)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          );
        })()}

        {/* No ticket selected */}
        {!activeTicketId && !isLoading && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t("navigator.selectPrompt")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main export                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export interface TicketDetailSheetProps {
  open: boolean;
  ticketId: number | null;
  storeId: string;
  tickets: Ticket[];
  technicians: CatalogTechnician[];
  filters?: TicketsFilters;
  onFiltersChange?: (f: TicketsFilters) => void;
  onClose: () => void;
}

export function TicketDetailSheet({
  open,
  ticketId,
  storeId,
  tickets,
  technicians,
  filters,
  onFiltersChange,
  onClose,
}: TicketDetailSheetProps) {
  const [activeTicketId, setActiveTicketId] = useState<number | null>(ticketId);
  const [search, setSearch] = useState("");
  const [issuesResponse, setIssuesResponse] = useState<TicketIssuesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const draft = useTicketDraft(storeId, activeTicketId);

  // Keep local active ticket synchronized with external selection.
  // Clearing to null is intentional to avoid stale ticket caching.
  useEffect(() => {
    setActiveTicketId(ticketId);
  }, [ticketId]);

  // When opening, ensure we always land on the externally selected ticket
  // (or fallback to first available ticket if parent passes null).
  useEffect(() => {
    if (!open) return;
    if (ticketId != null) {
      setActiveTicketId(ticketId);
      return;
    }
    setActiveTicketId((prev) => prev ?? tickets[0]?.id ?? null);
  }, [open, ticketId, tickets]);

  const loadIssues = useCallback(async () => {
    if (!activeTicketId || !storeId) return;
    setIsLoading(true); setLoadError(null);
    try {
      const result = await maintenanceTicketsService.getTicketIssues(storeId, activeTicketId);
      // Build a lookup of id → full root-level issue (root items have complete sub-arrays).
      const issueMap = new Map<number, TicketIssue>();
      result.data.forEach((issue) => issueMap.set(issue.id, issue));
      // Topological sort: parent always appears before child in the flat list.
      const sorted: TicketIssue[] = [];
      const visited = new Set<number>();
      const visit = (id: number): void => {
        if (visited.has(id)) return;
        visited.add(id);
        const issue = issueMap.get(id);
        if (!issue) return;
        if (issue.parentId != null && issueMap.has(issue.parentId)) visit(issue.parentId);
        sorted.push(issue);
      };
      result.data.forEach((issue) => visit(issue.id));
      setIssuesResponse({ data: sorted });
    } catch (err) {
      setLoadError(err instanceof MaintenanceTicketsError ? err.message : "Failed to load issues.");
    } finally { setIsLoading(false); }
  }, [activeTicketId, storeId]);

  // Load issues when sheet opens or active ticket changes
  useEffect(() => {
    if (open && activeTicketId) {
      setIssuesResponse(null);
      loadIssues();
    }
  }, [open, activeTicketId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear all state when sheet closes so stale activeTicketId can't
  // trigger a spurious fetch the next time the sheet opens.
  useEffect(() => {
    if (!open) {
      setIssuesResponse(null);
      setLoadError(null);
      setActiveTicketId(null);
    }
  }, [open]);

  function handleSelectTicket(id: number) {
    if (id === activeTicketId) return;
    // Clear stale data immediately so skeleton shows right away
    setIssuesResponse(null);
    setLoadError(null);
    setActiveTicketId(id);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={true}
        className="w-[95vw]! sm:w-[88vw]! lg:w-[75vw]! max-w-[95vw]! sm:max-w-[88vw]! lg:max-w-[75vw]! p-0 flex flex-col overflow-hidden"
      >
        {/* Mobile pill switcher */}
        {tickets.length > 0 && (
          <MobileTicketSwitcher tickets={tickets} activeId={activeTicketId} onSelect={handleSelectTicket} />
        )}

        {/* 2-pane layout */}
        <div className="flex flex-1 overflow-hidden">
          <RightPanel
            activeTicketId={activeTicketId}
            tickets={tickets}
            storeId={storeId}
            technicians={technicians}
            issuesResponse={issuesResponse}
            isLoading={isLoading}
            loadError={loadError}
            onRefresh={loadIssues}
            draft={draft}
          />
          <TicketNavigator
            tickets={tickets}
            activeId={activeTicketId}
            search={search}
            onSearchChange={setSearch}
            onSelect={handleSelectTicket}
            filters={filters}
            onFiltersChange={onFiltersChange}
            technicians={technicians}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
