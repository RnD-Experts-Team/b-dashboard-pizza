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
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type {
  Ticket,
  TicketIssue,
  TicketIssuesResponse,
  IssueStatus,
  CatalogTechnician,
} from "@/types/maintenance-tickets.types";
import {
  useTicketDraft,
  EMPTY_ISSUE_DRAFT,
  type IssueDraft,
} from "@/lib/hooks/use-ticket-draft";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string) {
  try { return format(new Date(iso), "MMM d, yyyy"); } catch { return iso; }
}

function fmtDateTime(iso: string) {
  try { return format(new Date(iso), "MMM d, yyyy HH:mm"); } catch { return iso; }
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
}

function TicketNavigator({ tickets, activeId, search, onSearchChange, onSelect }: NavigatorProps) {
  const t = useTranslations("maintenanceTickets");

  const filtered = search.trim()
    ? tickets.filter(
        (tk) =>
          String(tk.id).includes(search.trim()) ||
          tk.storeId.toLowerCase().includes(search.trim().toLowerCase())
      )
    : tickets;

  return (
    <aside className="hidden md:flex w-72 flex-col border-s bg-background/95 shrink-0 overflow-hidden">
      <div className="px-4 py-3 border-b shrink-0 space-y-2 bg-muted/20">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          {t("navigator.title")}
        </p>
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("navigator.searchPlaceholder")}
            className="h-8 ps-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            {t("navigator.noResults")}
          </p>
        )}
        {filtered.map((ticket) => (
          <button
            key={ticket.id}
            type="button"
            onClick={() => onSelect(ticket.id)}
            className={cn(
              "relative w-full text-start px-3 py-2.5 transition-colors hover:bg-muted/40 border rounded-md mb-2 last:mb-0",
              ticket.id === activeId &&
                "bg-accent border-primary/40 shadow-sm before:absolute before:start-0 before:inset-y-1 before:w-0.5 before:bg-primary before:rounded-e"
            )}
          >
            <p className={cn("text-sm font-medium truncate", ticket.id === activeId ? "text-foreground" : "text-muted-foreground")}>
              #{ticket.id}
            </p>
            <p className="text-xs text-muted-foreground truncate">{ticket.storeId}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-sm border px-1.5 py-px text-[10px] text-muted-foreground">
                {ticket.issueCount} {t("navigator.issueCount", { count: ticket.issueCount })}
              </span>
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
  const effectiveIds = issueIds ?? [issue.id];

  async function handleSubmit() {
    setIsSubmitting(true); setError(null);
    try {
      await maintenanceTicketsService.changeIssueStatus(storeId, ticketId, {
        ticket_issue_ids: effectiveIds, status,
      });
      onSuccess(); onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : t("detailSheet.actionError"));
    } finally { setIsSubmitting(false); }
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("detailSheet.changeStatus")}</p>
      <Select value={status} onValueChange={(v) => setStatus(v as IssueStatus)}>
        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">{t("status.pending")}</SelectItem>
          <SelectItem value="assigned">{t("status.assigned")}</SelectItem>
          <SelectItem value="in_progress">{t("status.in_progress")}</SelectItem>
          <SelectItem value="complete">{t("status.complete")}</SelectItem>
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>{t("common.cancel")}</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || (!issueIds && status === issue.status.value)}>
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
      onSuccess(); onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : t("detailSheet.actionError"));
    } finally { setIsSubmitting(false); }
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("detailSheet.assignIssue")}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t("detailSheet.assignDate")}</Label>
          <Input type="date" className="h-8 text-sm" value={issueDraft.assignDate}
            onChange={(e) => onPatchDraft({ assignDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("detailSheet.assignHour")} <span className="text-muted-foreground">({t("common.optional")})</span></Label>
          <Input type="time" className="h-8 text-sm" value={issueDraft.assignHour}
            onChange={(e) => onPatchDraft({ assignHour: e.target.value })} />
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
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
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

  async function handleSubmit() {
    if (!issueDraft.deferReason.trim()) { setError(t("detailSheet.deferReasonRequired")); return; }
    setIsSubmitting(true); setError(null);
    try {
      await maintenanceTicketsService.deferIssue(storeId, ticketId, issue.id, { reason: issueDraft.deferReason.trim() });
      onSuccess(); onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : t("detailSheet.actionError"));
    } finally { setIsSubmitting(false); }
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("detailSheet.deferIssue")}</p>
      <div className="space-y-1">
        <Label className="text-xs">{t("detailSheet.deferReason")}</Label>
        <Textarea className="text-sm resize-none min-h-20" placeholder={t("detailSheet.deferReasonPlaceholder")}
          value={issueDraft.deferReason} onChange={(e) => onPatchDraft({ deferReason: e.target.value })} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>{t("common.cancel")}</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}
          {t("detailSheet.defer")}
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
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to create diagnosis.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Diagnosis</p>
      <Textarea
        className="text-sm resize-none min-h-20"
        placeholder="Diagnosis notes"
        value={issueDraft.diagnosisBody}
        onChange={(e) => onPatchDraft({ diagnosisBody: e.target.value })}
      />
      <Input
        type="file"
        multiple
        className="h-8"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
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
  async function handleSubmit() {
    const body = issueDraft.warrantyBody.trim();
    if (!body) {
      setError("Warranty body is required.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await maintenanceTicketsService.createWarranty(storeId, ticketId, {
        ticket_issue_ids: issueIds ?? [issue.id],
        body,
      }, files);
      onClearDraftFields(["warrantyBody"]);
      setFiles([]);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to create warranty.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Warranty</p>
      <Textarea
        className="text-sm resize-none min-h-20"
        placeholder="Warranty notes"
        value={issueDraft.warrantyBody}
        onChange={(e) => onPatchDraft({ warrantyBody: e.target.value })}
      />
      <Input
        type="file"
        multiple
        className="h-8"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
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

function AttendancePanel({ issue, storeId, ticketId, technicians, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: LifecyclePanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit() {
    if (!issueDraft.attendanceTechnicianId) {
      setError("Technician is required.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await maintenanceTicketsService.createAttendanceEntry(storeId, ticketId, {
        ticket_issue_ids: issueIds ?? [issue.id],
        technician_id: Number(issueDraft.attendanceTechnicianId),
        start_clock: toRfc3339OrUndefined(issueDraft.attendanceStartClock),
        end_clock: toRfc3339OrUndefined(issueDraft.attendanceEndClock),
        start_break: toRfc3339OrUndefined(issueDraft.attendanceStartBreak),
        end_break: toRfc3339OrUndefined(issueDraft.attendanceEndBreak),
        start_parts_run: toRfc3339OrUndefined(issueDraft.attendanceStartPartsRun),
        end_parts_run: toRfc3339OrUndefined(issueDraft.attendanceEndPartsRun),
      });
      onClearDraftFields([
        "attendanceTechnicianId",
        "attendanceStartClock",
        "attendanceEndClock",
        "attendanceStartBreak",
        "attendanceEndBreak",
        "attendanceStartPartsRun",
        "attendanceEndPartsRun",
      ]);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to create attendance entry.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Attendance</p>
      <Select value={issueDraft.attendanceTechnicianId} onValueChange={(v) => onPatchDraft({ attendanceTechnicianId: v })}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select technician" /></SelectTrigger>
        <SelectContent>
          {technicians.filter((tech) => !tech.deletedAt).map((tech) => (
            <SelectItem key={tech.id} value={String(tech.id)}>{tech.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Input type="datetime-local" className="h-8" value={issueDraft.attendanceStartClock} onChange={(e) => onPatchDraft({ attendanceStartClock: e.target.value })} />
        <Input type="datetime-local" className="h-8" value={issueDraft.attendanceEndClock} onChange={(e) => onPatchDraft({ attendanceEndClock: e.target.value })} />
        <Input type="datetime-local" className="h-8" value={issueDraft.attendanceStartBreak} onChange={(e) => onPatchDraft({ attendanceStartBreak: e.target.value })} />
        <Input type="datetime-local" className="h-8" value={issueDraft.attendanceEndBreak} onChange={(e) => onPatchDraft({ attendanceEndBreak: e.target.value })} />
        <Input type="datetime-local" className="h-8" value={issueDraft.attendanceStartPartsRun} onChange={(e) => onPatchDraft({ attendanceStartPartsRun: e.target.value })} />
        <Input type="datetime-local" className="h-8" value={issueDraft.attendanceEndPartsRun} onChange={(e) => onPatchDraft({ attendanceEndPartsRun: e.target.value })} />
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

function PartUsagePanel({ issue, storeId, ticketId, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: Omit<LifecyclePanelProps, "technicians">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  async function handleSubmit() {
    const partId = asOptionalNumber(issueDraft.partId);
    const partCost = asOptionalNumber(issueDraft.partCost);
    if (!partId || partCost == null) {
      setError("Part ID and cost are required.");
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
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to create part usage.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Part Usage</p>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" className="h-8" placeholder="Part ID" value={issueDraft.partId} onChange={(e) => onPatchDraft({ partId: e.target.value })} />
        <Input type="number" className="h-8" placeholder="Cost" value={issueDraft.partCost} onChange={(e) => onPatchDraft({ partCost: e.target.value })} />
      </div>
      <Input
        type="file"
        multiple
        className="h-8"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
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

function PayEntryPanel({ issue, storeId, ticketId, technicians, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: LifecyclePanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to create pay entry.");
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" className="h-8" placeholder="Base pay" value={issueDraft.basePay} onChange={(e) => onPatchDraft({ basePay: e.target.value })} />
        <Input type="number" className="h-8" placeholder="Performance pay" value={issueDraft.performancePay} onChange={(e) => onPatchDraft({ performancePay: e.target.value })} />
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

function AttachTechsPanel({ issue, storeId, ticketId, technicians, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: LifecyclePanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to attach technicians.");
    } finally {
      setIsSubmitting(false);
    }
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
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

function DelayAssignmentPanel({ issue, storeId, ticketId, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: Omit<LifecyclePanelProps, "technicians">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit() {
    if (!issueDraft.delayAssignmentId || !issueDraft.delayNewDate || !issueDraft.delayReason.trim()) {
      setError("Assignment, date, and reason are required.");
      return;
    }
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
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to delay assignment.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Delay Assignment</p>
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
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" className="h-8" value={issueDraft.delayNewDate} onChange={(e) => onPatchDraft({ delayNewDate: e.target.value })} />
        <Input type="time" className="h-8" value={issueDraft.delayNewHour} onChange={(e) => onPatchDraft({ delayNewHour: e.target.value })} />
      </div>
      <Textarea className="text-sm resize-none min-h-20" placeholder="Reason" value={issueDraft.delayReason} onChange={(e) => onPatchDraft({ delayReason: e.target.value })} />
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

function ChangeTechsPanel({ issue, storeId, ticketId, technicians, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: LifecyclePanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to change technicians.");
    } finally {
      setIsSubmitting(false);
    }
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
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
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
  onClear: () => void;
  onSuccess: () => void;
}

function BulkActionBar({ issueIds, storeId, ticketId, technicians, onClear, onSuccess }: BulkActionBarProps) {
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
      {bulkAction === "diagnosis" && (
        <DiagnosisPanel issue={BULK_DUMMY_ISSUE} storeId={storeId} ticketId={ticketId}
          issueIds={issueIds}
          issueDraft={bulkDraft} onPatchDraft={patchDraft} onClearDraftFields={clearDraftFields}
          onClose={() => setBulkAction(null)} onSuccess={handleActionSuccess} />
      )}
      {bulkAction === "attendance" && (
        <AttendancePanel issue={BULK_DUMMY_ISSUE} storeId={storeId} ticketId={ticketId}
          technicians={technicians} issueIds={issueIds}
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
  children,
}: {
  label: string;
  count: number;
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
        <div className="flex-1 h-px bg-border ms-1" />
      </button>
      {open && <div>{children}</div>}
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
}: IssueNodeProps) {
  const t = useTranslations("maintenanceTickets");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);

  const title = issue.issueTitle ?? issue.otherTitle ?? `Issue #${issue.id}`;
  const canAssign = ["pending", "assigned"].includes(issue.status.value);
  const canDefer = issue.status.value !== "complete";

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
          <div className="rounded-lg border bg-card overflow-hidden">
            {/* Header (always visible) */}
            <button type="button" onClick={onToggleExpand}
              className="w-full flex items-start gap-3 px-4 py-3 text-start hover:bg-muted/30 transition-colors group">
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
                  <span className="text-[10px] font-mono text-muted-foreground">#{issue.id}</span>
                </div>
              </div>
              <div className="shrink-0 text-muted-foreground mt-0.5 group-hover:text-foreground transition-colors">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </button>

            {/* Expandable body */}
            {isExpanded && (
              <div className="border-t px-4 py-3 space-y-3">
                {/* Description */}
                {issue.description ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">{issue.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">{t("detailSheet.noDescription")}</p>
                )}

                {/* Technicians */}
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
                {issue.assignments.length > 0 && (
                  <div className="space-y-1.5">
                    {issue.assignments.map((a) => (
                      <div key={a.id} className="rounded border bg-muted/10 px-2 py-1.5 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>{fmtDate(a.assignedDate)}</span>
                          {a.assignedHour && <><Clock className="h-3 w-3 shrink-0" /><span>{a.assignedHour}</span></>}
                          {a.technicians.length > 0 && (
                            <span>· {a.technicians.map((tech) => tech.name).join(", ")}</span>
                          )}
                        </div>
                        {a.delays.length > 0 && (
                          <div className="ps-4 border-s space-y-1">
                            {a.delays.map((delay) => (
                              <div key={delay.id} className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
                                <TimerReset className="h-3 w-3" />
                                <span>Delayed to {fmtDate(delay.newDate)}{delay.newHour ? ` ${delay.newHour}` : ""}</span>
                                <span className="italic">{delay.reason}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Lifecycle timeline rows */}
                {issue.diagnoses.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Diagnoses</p>
                    {issue.diagnoses.map((item) => (
                      <div key={item.id} className={cn("text-xs rounded border px-2 py-1.5", item.mistaken && "opacity-60 line-through") }>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          <span>{item.body || "No notes"}</span>
                          {item.mistaken && <span className="rounded-full border px-1.5 py-px text-[10px]">mistaken</span>}
                        </div>
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
                      </div>
                    ))}
                  </div>
                )}

                {issue.attendanceEntries.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Attendance</p>
                    {issue.attendanceEntries.map((item) => (
                      <div key={item.id} className={cn("text-xs rounded border px-2 py-1.5 flex flex-wrap items-center gap-2", item.mistaken && "opacity-60 line-through") }>
                        <Wrench className="h-3 w-3" />
                        <span>Tech #{item.technicianId}</span>
                        {item.startClock && <span>{item.startClock}</span>}
                        {item.endClock && <span>- {item.endClock}</span>}
                        {item.mistaken && <span className="rounded-full border px-1.5 py-px text-[10px]">mistaken</span>}
                      </div>
                    ))}
                  </div>
                )}

                {issue.partUsages.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Part Usage</p>
                    {issue.partUsages.map((item) => (
                      <div key={item.id} className={cn("text-xs rounded border px-2 py-1.5 flex flex-wrap items-center gap-2", item.mistaken && "opacity-60 line-through") }>
                        <Package className="h-3 w-3" />
                        <span>{item.part?.name || `Part #${item.partId}`}</span>
                        <span className="font-medium">${item.cost.toFixed(2)}</span>
                        {item.mistaken && <span className="rounded-full border px-1.5 py-px text-[10px]">mistaken</span>}
                      </div>
                    ))}
                  </div>
                )}

                {issue.payEntries.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pay Entries</p>
                    {issue.payEntries.map((item) => (
                      <div key={item.id} className={cn("text-xs rounded border px-2 py-1.5 flex flex-wrap items-center gap-2", item.mistaken && "opacity-60 line-through") }>
                        <Wallet className="h-3 w-3" />
                        <span>Tech #{item.technicianId}</span>
                        {item.basePay != null && <span>Base ${item.basePay.toFixed(2)}</span>}
                        {item.performancePay != null && <span>Perf ${item.performancePay.toFixed(2)}</span>}
                        {item.mistaken && <span className="rounded-full border px-1.5 py-px text-[10px]">mistaken</span>}
                      </div>
                    ))}
                  </div>
                )}

                {issue.warranties.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Warranties</p>
                    {issue.warranties.map((item) => (
                      <div key={item.id} className={cn("text-xs rounded border px-2 py-1.5 flex flex-wrap items-center gap-2", item.mistaken && "opacity-60 line-through") }>
                        <ShieldCheck className="h-3 w-3" />
                        <span>{item.body || "No notes"}</span>
                        {item.mistaken && <span className="rounded-full border px-1.5 py-px text-[10px]">mistaken</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Action menu */}
                <div className="flex items-center justify-between pt-1">
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
                {activeAction === "diagnosis" && (
                  <DiagnosisPanel issue={issue} storeId={storeId} ticketId={ticketId}
                    issueDraft={issueDraft} onPatchDraft={onPatchDraft} onClearDraftFields={onClearDraftFields}
                    onClose={() => setActiveAction(null)} onSuccess={onReload} />
                )}
                {activeAction === "attendance" && (
                  <AttendancePanel issue={issue} storeId={storeId} ticketId={ticketId}
                    technicians={technicians}
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
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState<"none" | "status" | "priority" | "technician" | "part">("none");
  const [finalNoteOpen, setFinalNoteOpen] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Clear selection when ticket changes
  useEffect(() => {
    setIsSelectMode(false);
    setSelectedIssueIds(new Set());
  }, [activeTicketId]);

  function toggleIssueSelect(id: number) {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const activeTicket = tickets.find((tk) => tk.id === activeTicketId);

  async function handleFinalNoteSubmit() {
    if (!activeTicketId) return;
    setIsSubmittingNote(true); setNoteError(null);
    try {
      await maintenanceTicketsService.setFinalNote(storeId, activeTicketId, {
        final_note: draft.finalNoteDraft.trim() || null,
      });
      setFinalNoteOpen(false);
    } catch (err) {
      setNoteError(err instanceof MaintenanceTicketsError ? err.message : t("detailSheet.actionError"));
    } finally { setIsSubmittingNote(false); }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sticky header */}
      <header className="shrink-0 px-6 py-4 border-b flex items-start justify-between gap-4">
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
                  <span>{activeTicket.issueCount} {t("navigator.issueCount", { count: activeTicket.issueCount })}</span>
                </>
              )}
            </div>
          )}
          <SheetDescription className="sr-only">{t("detailSheet.description")}</SheetDescription>
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
              <SelectItem value="technician">{t("groupBy.technician")}</SelectItem>
              <SelectItem value="part">{t("groupBy.part")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={isSelectMode ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setIsSelectMode((v) => !v);
              if (isSelectMode) setSelectedIssueIds(new Set());
            }}
            title={isSelectMode ? "Exit select mode" : "Select issues for bulk action"}
            aria-label="Toggle issue selection"
          >
            <ListChecks className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh}
            disabled={isLoading} aria-label={t("refresh")}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </header>

      {/* Scrollable issue body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
        {/* Skeleton */}
        {isLoading && !issuesResponse && (
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
        {loadError && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/70" />
            <p className="text-sm text-muted-foreground">{loadError}</p>
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
        {issuesResponse && issuesResponse.data.length > 0 && (
          <div>
            {/* Bulk action bar — visible when in select mode and ≥1 issue selected */}
            {isSelectMode && selectedIssueIds.size > 0 && (
              <BulkActionBar
                issueIds={Array.from(selectedIssueIds)}
                storeId={storeId}
                ticketId={activeTicketId!}
                technicians={technicians}
                onClear={() => setSelectedIssueIds(new Set())}
                onSuccess={() => {
                  setIsSelectMode(false);
                  setSelectedIssueIds(new Set());
                  onRefresh();
                }}
              />
            )}
            {/* ── Group-by section headers ─────────────────────────────── */}
            {groupBy !== "none" && (() => {
              // Derive a group key for each ROOT issue (deferred children inherit parent's group)
              const getGroupKeys = (iss: TicketIssue): string[] => {
                if (groupBy === "status") return [iss.status.label];
                if (groupBy === "priority") return [iss.priority.label];
                if (groupBy === "technician") {
                  return iss.technicians.length > 0
                    ? iss.technicians.map((t) => t.name)
                    : ["Unassigned"];
                }
                if (groupBy === "part") {
                  const names = iss.partUsages
                    .map((p) => p.part?.name)
                    .filter((n): n is string => !!n);
                  return names.length > 0 ? names : ["No parts"];
                }
                return ["Other"];
              };

              // Build ordered group → root issues map
              const orderedKeys: string[] = [];
              const groupedRoots = new Map<string, TicketIssue[]>();
              // childToRoot map for descendants
              const childToRoot = new Map<number, number>();
              for (const iss of issuesResponse.data) {
                if (iss.parentId == null) childToRoot.set(iss.id, iss.id);
                else childToRoot.set(iss.id, childToRoot.get(iss.parentId) ?? iss.id);
              }
              for (const iss of issuesResponse.data) {
                if (iss.parentId != null) continue; // only roots drive groups
                for (const key of getGroupKeys(iss)) {
                  if (!groupedRoots.has(key)) { groupedRoots.set(key, []); orderedKeys.push(key); }
                  groupedRoots.get(key)!.push(iss);
                }
              }
              // descendants map per root id
              const descendantsOf = new Map<number, TicketIssue[]>();
              for (const iss of issuesResponse.data) {
                if (iss.parentId == null) continue;
                const rootId = childToRoot.get(iss.id)!;
                if (!descendantsOf.has(rootId)) descendantsOf.set(rootId, []);
                descendantsOf.get(rootId)!.push(iss);
              }

              const renderGroup = (rootIssue: TicketIssue) => {
                const descs = descendantsOf.get(rootIssue.id) ?? [];
                return (
                <div key={rootIssue.id}>
                  <IssueNode
                    issue={rootIssue}
                    storeId={storeId}
                    ticketId={activeTicketId!}
                    technicians={technicians}
                    isExpanded={draft.isIssueExpanded(rootIssue.id)}
                    onToggleExpand={() => draft.toggleIssueExpanded(rootIssue.id)}
                    issueDraft={draft.getIssueDraft(rootIssue.id)}
                    onPatchDraft={(patch) => draft.patchIssueDraft(rootIssue.id, patch)}
                    onClearDraftFields={(keys) => draft.clearIssueDraftFields(rootIssue.id, keys)}
                    onReload={onRefresh}
                    depth={0}
                    isLast={descs.length === 0}
                    isSelectMode={isSelectMode}
                    selectedIssueIds={selectedIssueIds}
                    onToggleSelectId={toggleIssueSelect}
                  />
                  {descs.length > 0 && (
                    <div className="ms-[9px]">
                      {descs.map((child, ci) => (
                        <div key={child.id} className="relative ps-5">
                          <div className={cn("absolute start-0 w-px bg-border", ci === descs.length - 1 ? "top-0 h-3" : "top-0 bottom-0")} />
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
                            isSelectMode={isSelectMode}
                            selectedIssueIds={selectedIssueIds}
                            onToggleSelectId={toggleIssueSelect}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                );
              };

              return orderedKeys.map((key) => (
                <GroupSection key={key} label={key} count={groupedRoots.get(key)!.length}>
                  {groupedRoots.get(key)!.map(renderGroup)}
                </GroupSection>
              ));
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
                      isSelectMode={isSelectMode}
                      selectedIssueIds={selectedIssueIds}
                      onToggleSelectId={toggleIssueSelect}
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
                              isSelectMode={isSelectMode}
                              selectedIssueIds={selectedIssueIds}
                              onToggleSelectId={toggleIssueSelect}
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
        )}

        {/* No ticket selected */}
        {!activeTicketId && !isLoading && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t("navigator.selectPrompt")}</p>
          </div>
        )}
      </div>

      {/* Sticky footer: final note */}
      <div className="shrink-0 border-t">
        <button type="button" disabled={!activeTicketId || isLoading}
          onClick={() => setFinalNoteOpen((v) => !v)}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-6 py-3 text-sm text-muted-foreground",
            "hover:text-foreground hover:bg-muted/30 transition-colors",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}>
          <span className="flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            {t("detailSheet.setFinalNote")}
            {draft.finalNoteDraft && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
            )}
          </span>
          {finalNoteOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {finalNoteOpen && (
          <div className="px-6 pb-4 space-y-2">
            <Textarea className="text-sm resize-none min-h-20"
              placeholder={t("detailSheet.finalNotePlaceholder")}
              value={draft.finalNoteDraft}
              onChange={(e) => draft.setFinalNoteDraft(e.target.value)} />
            {noteError && <p className="text-xs text-destructive">{noteError}</p>}
            <div className="flex items-center justify-between gap-2">
              {draft.lastSavedAt && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3" />
                  {t("detailSheet.draftSaved")}
                </span>
              )}
              <div className="flex gap-2 ms-auto">
                <Button variant="ghost" size="sm" onClick={() => setFinalNoteOpen(false)} disabled={isSubmittingNote}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" onClick={handleFinalNoteSubmit} disabled={isSubmittingNote || !activeTicketId}>
                  {isSubmittingNote && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}
                  {t("common.save")}
                </Button>
              </div>
            </div>
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
  onClose: () => void;
}

export function TicketDetailSheet({
  open,
  ticketId,
  storeId,
  tickets,
  technicians,
  onClose,
}: TicketDetailSheetProps) {
  const [activeTicketId, setActiveTicketId] = useState<number | null>(ticketId);
  const [search, setSearch] = useState("");
  const [issuesResponse, setIssuesResponse] = useState<TicketIssuesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const draft = useTicketDraft(storeId, activeTicketId);

  // Sync active ticket when parent ticketId changes
  useEffect(() => {
    if (ticketId !== null) setActiveTicketId(ticketId);
  }, [ticketId]);

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

  // Clear data when sheet closes
  useEffect(() => {
    if (!open) { setIssuesResponse(null); setLoadError(null); }
  }, [open]);

  function handleSelectTicket(id: number) {
    if (id === activeTicketId) return;
    setActiveTicketId(id);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={true}
        className="w-[75vw]! max-w-[75vw]! p-0 flex flex-col overflow-hidden"
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
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
