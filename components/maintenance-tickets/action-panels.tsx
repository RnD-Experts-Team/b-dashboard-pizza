"use client";

/**
 * The inline action panels: everything the coordinator can DO to an issue.
 *
 * Extracted verbatim from ticket-detail-sheet.tsx. They were module-private
 * inside a 4,424-line file, which meant the only way to offer these actions on
 * another surface was to write them again. They are exported now so the ticket
 * page, the bulk bar and the sheet all drive the same code.
 *
 * Every panel takes the same shape -- an issue, where it lives, and two
 * callbacks -- so a caller can render any of them without knowing which.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateOrTimestamp } from "@/lib/utils/date-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type {
  TicketIssue,
  IssueStatus,
  Priority,
  CatalogIssue,
  CatalogTechnician,
} from "@/types/maintenance-tickets.types";
import type { IssueDraft } from "@/lib/hooks/use-ticket-draft";
import { SearchCreateCombobox } from "./search-create-combobox";
import { PasteFileZone } from "./paste-file-zone";
import { DatePicker, TimePicker, DateTimePicker } from "./form-bits";
import { SELECT_CONTENT_CLS } from "./ticket-chips";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Inline action panels                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface StatusPanelProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  /** When provided, sends all these IDs instead of [issue.id] (bulk mode) */
  issueIds?: number[];
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangeStatusPanel({ issue, storeId, ticketId, issueIds, onClose, onSuccess }: StatusPanelProps) {
  const t = useTranslations("maintenanceTickets");
  const [status, setStatus] = useState<IssueStatus>(issue.status.value as IssueStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const effectiveIds = issueIds ?? [issue.id];
  const hasChanged = issueIds ? true : status !== (issue.status.value as IssueStatus);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await maintenanceTicketsService.changeIssueStatus(storeId, ticketId, {
        ticket_issue_ids: effectiveIds, status,
      });
      toast.success("Status updated successfully");
      onSuccess(); onClose();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Something went wrong.");
    } finally { setIsSubmitting(false); }
  }

  const statusOptions: { value: IssueStatus; label: string }[] = [
    { value: "pending", label: t("status.pending") },
    { value: "assigned", label: t("status.assigned") },
    { value: "in_progress", label: t("status.in_progress") },
    { value: "complete", label: t("status.complete") },
  ];

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

export interface AssignPriorityPanelProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  onClose: () => void;
  onSuccess: () => void;
}

/** Sets or clears the independent `assignedPriority` — separate from `priority`, which never changes after creation. */
export function AssignPriorityPanel({ issue, storeId, ticketId, onClose, onSuccess }: AssignPriorityPanelProps) {
  const initial = (issue.assignedPriority?.value as Priority | undefined) ?? null;
  const [priority, setPriority] = useState<Priority | null>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasChanged = priority !== initial;

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await maintenanceTicketsService.setAssignedPriority(storeId, ticketId, issue.id, { priority });
      toast.success(priority ? "Assigned priority updated" : "Assigned priority cleared");
      onSuccess(); onClose();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Something went wrong.");
    } finally { setIsSubmitting(false); }
  }

  const priorityOptions: { value: Priority; label: string }[] = [
    { value: "urgent", label: "Urgent" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assign Priority</p>
      <div className="flex flex-wrap gap-1.5">
        {priorityOptions.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPriority(p.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
              priority === p.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-input hover:bg-muted/50"
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPriority(null)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
            priority === null
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-input hover:bg-muted/50"
          )}
        >
          Clear
        </button>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !hasChanged}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

export interface RelinkIssuePanelProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  onClose: () => void;
  onSuccess: () => void;
}

/** Re-links this ticket-issue line to a different catalog issue. Only the catalog association changes. */
export function RelinkIssuePanel({ issue, storeId, ticketId, onClose, onSuccess }: RelinkIssuePanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogIssues, setCatalogIssues] = useState<CatalogIssue[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(issue.issueId);

  useEffect(() => {
    const ctrl = new AbortController();
    setCatalogLoading(true);
    maintenanceTicketsService.getCatalogIssues(ctrl.signal, storeId)
      .then((issues) => setCatalogIssues(issues.filter((i) => !i.deletedAt)))
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
    return () => ctrl.abort();
  }, [storeId]);

  const hasChanged = selectedId !== issue.issueId;

  async function handleSubmit() {
    if (!selectedId) {
      setError("Select a catalog issue.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await maintenanceTicketsService.relinkIssue(storeId, ticketId, issue.id, { issue_id: selectedId });
      toast.success("Issue re-linked successfully");
      onSuccess(); onClose();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Something went wrong.");
    } finally { setIsSubmitting(false); }
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Change Issue</p>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Catalog issue <span className="text-destructive">*</span></Label>
        {/* No onCreate — re-linking only picks an existing catalog issue, never creates one. */}
        <SearchCreateCombobox
          items={catalogIssues.map((i) => ({ id: i.id, label: i.title }))}
          selectedId={selectedId}
          onSelect={setSelectedId}
          placeholder="Search issues…"
          loading={catalogLoading}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || catalogLoading || !hasChanged}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

export interface AssignPanelProps {
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

export function AssignPanel({ issue, storeId, ticketId, technicians, issueIds, issueDraft, onPatchDraft, onClose, onSuccess }: AssignPanelProps) {
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
      toast.success("Assignment saved successfully");
      onSuccess(); onClose();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Something went wrong.");
    } finally { setIsSubmitting(false); }
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

export interface DeferPanelProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  issueDraft: IssueDraft;
  onPatchDraft: (patch: Partial<IssueDraft>) => void;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeferPanel({ issue, storeId, ticketId, issueDraft, onPatchDraft, onClose, onSuccess }: DeferPanelProps) {
  const t = useTranslations("maintenanceTickets");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!issueDraft.deferReason.trim()) { setError(t("detailSheet.deferReasonRequired")); return; }
    setIsSubmitting(true); setError(null);
    try {
      await maintenanceTicketsService.deferIssue(storeId, ticketId, issue.id, { reason: issueDraft.deferReason.trim() });
      toast.success("Issue deferred successfully");
      onSuccess(); onClose();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Something went wrong.");
    } finally { setIsSubmitting(false); }
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

export interface WaitPanelProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  issueDraft: IssueDraft;
  onPatchDraft: (patch: Partial<IssueDraft>) => void;
  onClose: () => void;
  onSuccess: () => void;
}

export function WaitPanel({ issue, storeId, ticketId, issueDraft, onPatchDraft, onClose, onSuccess }: WaitPanelProps) {
  const t = useTranslations("maintenanceTickets");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!issueDraft.waitReason.trim()) { setError(t("detailSheet.waitReasonRequired")); return; }
    setIsSubmitting(true); setError(null);
    try {
      await maintenanceTicketsService.waitIssue(storeId, ticketId, issue.id, { reason: issueDraft.waitReason.trim() });
      toast.success("Issue marked as waiting");
      onSuccess(); onClose();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Something went wrong.");
    } finally { setIsSubmitting(false); }
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("detailSheet.waitIssue")}</p>
      <div className="space-y-1">
        <Label className="text-xs">{t("detailSheet.waitReason")} <span className="text-destructive">*</span></Label>
        <Textarea className="text-sm resize-none min-h-20" placeholder={t("detailSheet.waitReasonPlaceholder")}
          value={issueDraft.waitReason} onChange={(e) => onPatchDraft({ waitReason: e.target.value })} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>{t("common.cancel")}</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !issueDraft.waitReason.trim()}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}
          {t("detailSheet.wait")}
        </Button>
      </div>
    </div>
  );
}

export interface CancelPanelProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  issueIds?: number[];
  issueDraft: IssueDraft;
  onPatchDraft: (patch: Partial<IssueDraft>) => void;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelPanel({ issue, storeId, ticketId, issueIds, issueDraft, onPatchDraft, onClose, onSuccess }: CancelPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      toast.success("Issue cancelled successfully");
      onSuccess(); onClose();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Something went wrong.");
    } finally { setIsSubmitting(false); }
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

export function asOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toRfc3339OrUndefined(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export interface LifecyclePanelProps {
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

export function DiagnosisPanel({ issue, storeId, ticketId, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: Omit<LifecyclePanelProps, "technicians">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await maintenanceTicketsService.createDiagnosis(storeId, ticketId, {
        ticket_issue_ids: issueIds ?? [issue.id],
        body: issueDraft.diagnosisBody.trim() || "",
      }, files);
      onClearDraftFields(["diagnosisBody"]);
      setFiles([]);
      toast.success("Troubleshooting saved successfully");
      onSuccess(); onClose();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Troubleshooting</p>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Notes</Label>
        <Textarea
          className="text-sm resize-none min-h-20"
          placeholder="Troubleshooting notes"
          value={issueDraft.diagnosisBody}
          onChange={(e) => onPatchDraft({ diagnosisBody: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Attachments</Label>
        <PasteFileZone files={files} onChange={setFiles} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

export function WarrantyPanel({ issue, storeId, ticketId, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: Omit<LifecyclePanelProps, "technicians">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
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
      toast.success("Warranty saved successfully");
      onSuccess(); onClose();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
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
        <PasteFileZone files={files} onChange={setFiles} />
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


export function PayEntryPanel({ issue, storeId, ticketId, technicians, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: LifecyclePanelProps) {
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
      toast.success("Pay entry saved successfully");
      onSuccess(); onClose();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Pay Entry</p>
      <Select value={issueDraft.payTechnicianId} onValueChange={(v) => onPatchDraft({ payTechnicianId: v })}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select technician" /></SelectTrigger>
        <SelectContent position="popper" className={SELECT_CONTENT_CLS}>
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

export function AttachTechsPanel({ issue, storeId, ticketId, technicians, issueIds, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: LifecyclePanelProps) {
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
      toast.success("Technicians attached successfully");
      onSuccess(); onClose();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Something went wrong.");
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
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || issueDraft.attachTechs.length === 0}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

export function DelayAssignmentPanel({ issue, storeId, ticketId, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: Omit<LifecyclePanelProps, "technicians">) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = !!issueDraft.delayAssignmentId && !!issueDraft.delayNewDate && !!issueDraft.delayReason.trim();
  async function handleSubmit() {
    setIsSubmitting(true);
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
      toast.success("Assignment delayed successfully");
      onSuccess(); onClose();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Delay Assignment</p>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Assignment <span className="text-destructive">*</span></Label>
        <Select value={issueDraft.delayAssignmentId} onValueChange={(v) => onPatchDraft({ delayAssignmentId: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select assignment" /></SelectTrigger>
          <SelectContent position="popper" className={SELECT_CONTENT_CLS}>
            {issue.assignments.map((assignment) => (
              <SelectItem key={assignment.id} value={String(assignment.id)}>
                #{assignment.id} · {formatDateOrTimestamp(assignment.assignedDate, "MMM d, yyyy")}
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
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !canSubmit}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

export function ChangeTechsPanel({ issue, storeId, ticketId, technicians, issueDraft, onPatchDraft, onClearDraftFields, onClose, onSuccess }: LifecyclePanelProps) {
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
      toast.success("Technicians updated successfully");
      onSuccess(); onClose();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Change Assignment Technicians</p>
      <Select value={issueDraft.changeAssignmentId} onValueChange={(v) => onPatchDraft({ changeAssignmentId: v })}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select assignment" /></SelectTrigger>
        <SelectContent position="popper" className={SELECT_CONTENT_CLS}>
          {issue.assignments.map((assignment) => (
            <SelectItem key={assignment.id} value={String(assignment.id)}>
              #{assignment.id} · {formatDateOrTimestamp(assignment.assignedDate, "MMM d, yyyy")}
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

