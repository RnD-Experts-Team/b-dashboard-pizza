"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Clock,
  Loader2,
  RefreshCw,
  User,
  AlertCircle,
  StickyNote,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type {
  TicketIssue,
  TicketIssuesResponse,
  IssueStatus,
  CatalogTechnician,
  AssignIssuesPayload,
} from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Badge helpers (reused from tickets-table)                              */
/* ────────────────────────────────────────────────────────────────────────── */

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_CONFIG: Record<string, { variant: BadgeVariant; className: string }> = {
  pending:     { variant: "outline",   className: "text-yellow-700 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30" },
  assigned:    { variant: "secondary", className: "text-blue-700 border-blue-400 bg-blue-50 dark:bg-blue-950/30" },
  in_progress: { variant: "outline",   className: "text-orange-700 border-orange-400 bg-orange-50 dark:bg-orange-950/30" },
  complete:    { variant: "default",   className: "text-green-700 border-green-400 bg-green-50 dark:bg-green-950/30" },
  deferred:    { variant: "secondary", className: "text-purple-700 border-purple-400 bg-purple-50 dark:bg-purple-950/30" },
};

const PRIORITY_CONFIG: Record<string, { variant: BadgeVariant; className: string }> = {
  urgent: { variant: "destructive", className: "" },
  high:   { variant: "outline",     className: "text-orange-700 border-orange-400 bg-orange-50 dark:bg-orange-950/30" },
  medium: { variant: "secondary",   className: "" },
  low:    { variant: "outline",     className: "text-muted-foreground" },
};

function StatusBadge({ value, label }: { value: string; label: string }) {
  const config = STATUS_CONFIG[value] ?? { variant: "outline" as BadgeVariant, className: "" };
  return (
    <Badge variant={config.variant} className={cn("text-xs font-medium", config.className)}>
      {label}
    </Badge>
  );
}

function PriorityBadge({ value, label }: { value: string; label: string }) {
  const config = PRIORITY_CONFIG[value] ?? { variant: "outline" as BadgeVariant, className: "" };
  return (
    <Badge variant={config.variant} className={cn("text-xs font-medium", config.className)}>
      {label}
    </Badge>
  );
}

function fmtDate(iso: string) {
  try { return format(new Date(iso), "MMM d, yyyy"); } catch { return iso; }
}

function fmtDateTime(iso: string) {
  try { return format(new Date(iso), "MMM d, yyyy HH:mm"); } catch { return iso; }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Sub-dialogs                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

interface ChangeStatusDialogProps {
  open: boolean;
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  onClose: () => void;
  onSuccess: () => void;
}

function ChangeStatusDialog({ open, issue, storeId, ticketId, onClose, onSuccess }: ChangeStatusDialogProps) {
  const t = useTranslations("maintenanceTickets");
  const [status, setStatus] = useState<IssueStatus>(issue.status.value as IssueStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setStatus(issue.status.value as IssueStatus); setError(null); } }, [open, issue.status.value]);

  async function handleSubmit() {
    setIsSubmitting(true); setError(null);
    try {
      await maintenanceTicketsService.changeIssueStatus(storeId, ticketId, {
        ticket_issue_ids: [issue.id],
        status,
      });
      onSuccess(); onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : t("detailSheet.actionError"));
    } finally { setIsSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("detailSheet.changeStatus")}</DialogTitle>
          <DialogDescription>{t("detailSheet.changeStatusDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>{t("detailSheet.newStatus")}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as IssueStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">{t("status.pending")}</SelectItem>
              <SelectItem value="assigned">{t("status.assigned")}</SelectItem>
              <SelectItem value="in_progress">{t("status.in_progress")}</SelectItem>
              <SelectItem value="complete">{t("status.complete")}</SelectItem>
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || status === issue.status.value}>
            {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AssignDialogProps {
  open: boolean;
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  technicians: CatalogTechnician[];
  onClose: () => void;
  onSuccess: () => void;
}

function AssignDialog({ open, issue, storeId, ticketId, technicians, onClose, onSuccess }: AssignDialogProps) {
  const t = useTranslations("maintenanceTickets");
  const [selectedTechs, setSelectedTechs] = useState<number[]>([]);
  const [assignedDate, setAssignedDate] = useState("");
  const [assignedHour, setAssignedHour] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTechs = technicians.filter((t) => !t.deletedAt);

  useEffect(() => { if (open) { setSelectedTechs([]); setAssignedDate(""); setAssignedHour(""); setError(null); } }, [open]);

  function toggleTech(id: number) {
    setSelectedTechs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSubmit() {
    if (!assignedDate) { setError(t("detailSheet.assignDateRequired")); return; }
    if (selectedTechs.length === 0) { setError(t("detailSheet.assignTechRequired")); return; }
    setIsSubmitting(true); setError(null);
    try {
      const payload: AssignIssuesPayload = {
        ticket_issue_ids: [issue.id],
        technician_ids: selectedTechs,
        assigned_date: assignedDate,
        ...(assignedHour && { assigned_hour: assignedHour }),
      };
      await maintenanceTicketsService.assignIssues(storeId, ticketId, payload);
      onSuccess(); onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : t("detailSheet.actionError"));
    } finally { setIsSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("detailSheet.assignIssue")}</DialogTitle>
          <DialogDescription>{t("detailSheet.assignIssueDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>{t("detailSheet.assignDate")}</Label>
            <Input type="date" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t("detailSheet.assignHour")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
            <Input type="time" value={assignedHour} onChange={(e) => setAssignedHour(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t("detailSheet.selectTechnicians")}</Label>
            <div className="rounded-md border max-h-48 overflow-y-auto divide-y">
              {activeTechs.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">{t("detailSheet.noTechnicians")}</p>
              )}
              {activeTechs.map((tech) => (
                <button
                  key={tech.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-start",
                    selectedTechs.includes(tech.id) && "bg-accent"
                  )}
                  onClick={() => toggleTech(tech.id)}
                >
                  <div className={cn("h-4 w-4 rounded border shrink-0 flex items-center justify-center",
                    selectedTechs.includes(tech.id) ? "bg-primary border-primary text-primary-foreground" : "border-input"
                  )}>
                    {selectedTechs.includes(tech.id) && <span className="text-[10px]">✓</span>}
                  </div>
                  <div>
                    <p className="font-medium">{tech.name}</p>
                    {tech.categoryName && <p className="text-xs text-muted-foreground">{tech.categoryName}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("detailSheet.assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeferDialogProps {
  open: boolean;
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  onClose: () => void;
  onSuccess: () => void;
}

function DeferDialog({ open, issue, storeId, ticketId, onClose, onSuccess }: DeferDialogProps) {
  const t = useTranslations("maintenanceTickets");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setReason(""); setError(null); } }, [open]);

  async function handleSubmit() {
    if (!reason.trim()) { setError(t("detailSheet.deferReasonRequired")); return; }
    setIsSubmitting(true); setError(null);
    try {
      await maintenanceTicketsService.deferIssue(storeId, ticketId, issue.id, { reason: reason.trim() });
      onSuccess(); onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : t("detailSheet.actionError"));
    } finally { setIsSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("detailSheet.deferIssue")}</DialogTitle>
          <DialogDescription>{t("detailSheet.deferIssueDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>{t("detailSheet.deferReason")}</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("detailSheet.deferReasonPlaceholder")} className="min-h-25" />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("detailSheet.defer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FinalNoteDialogProps {
  open: boolean;
  storeId: string;
  ticketId: number;
  currentNote: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function FinalNoteDialog({ open, storeId, ticketId, currentNote, onClose, onSuccess }: FinalNoteDialogProps) {
  const t = useTranslations("maintenanceTickets");
  const [note, setNote] = useState(currentNote ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setNote(currentNote ?? ""); setError(null); } }, [open, currentNote]);

  async function handleSubmit() {
    setIsSubmitting(true); setError(null);
    try {
      await maintenanceTicketsService.setFinalNote(storeId, ticketId, { final_note: note.trim() || null });
      onSuccess(); onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : t("detailSheet.actionError"));
    } finally { setIsSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("detailSheet.setFinalNote")}</DialogTitle>
          <DialogDescription>{t("detailSheet.setFinalNoteDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("detailSheet.finalNotePlaceholder")} className="min-h-30" />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Issue card                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

interface IssueCardProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  technicians: CatalogTechnician[];
  onReload: () => void;
  depth?: number;
}

function IssueCard({ issue, storeId, ticketId, technicians, onReload, depth = 0 }: IssueCardProps) {
  const t = useTranslations("maintenanceTickets");
  const [activeDialog, setActiveDialog] = useState<"status" | "assign" | "defer" | null>(null);

  const title = issue.issueTitle ?? issue.otherTitle ?? `Issue #${issue.id}`;

  return (
    <div className={cn("rounded-lg border space-y-3 p-4", depth > 0 && "ms-4 border-l-4 border-l-purple-300 dark:border-l-purple-700")}>
      {/* Issue header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {depth > 0 && (
            <Badge variant="outline" className="text-xs text-purple-700 border-purple-400">
              {t("detailSheet.deferred")}
            </Badge>
          )}
          <span className="text-sm font-semibold">{title}</span>
          <StatusBadge value={issue.status.value} label={issue.status.label} />
          <PriorityBadge value={issue.priority.value} label={issue.priority.label} />
        </div>
        <span className="text-xs text-muted-foreground font-mono">#{issue.id}</span>
      </div>

      {/* Description */}
      {issue.description && (
        <p className="text-sm text-muted-foreground">{issue.description}</p>
      )}

      {/* Assigned technicians */}
      {issue.technicians.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {issue.technicians.map((tech) => (
            <span key={tech.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
              <User className="h-3 w-3" /> {tech.name}
            </span>
          ))}
        </div>
      )}

      {/* Assignments */}
      {issue.assignments.length > 0 && (
        <div className="space-y-1">
          {issue.assignments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>{fmtDate(a.assignedDate)}</span>
              {a.assignedHour && (
                <>
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{a.assignedHour}</span>
                </>
              )}
              {a.technicians.length > 0 && (
                <span>— {a.technicians.map((t) => t.name).join(", ")}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setActiveDialog("status")}>
          {t("detailSheet.changeStatus")}
        </Button>
        {["pending", "assigned"].includes(issue.status.value) && (
          <Button variant="outline" size="sm" onClick={() => setActiveDialog("assign")}>
            {t("detailSheet.assignIssue")}
          </Button>
        )}
        {!["complete", "deferred"].includes(issue.status.value) && (
          <Button variant="outline" size="sm" onClick={() => setActiveDialog("defer")}>
            {t("detailSheet.deferIssue")}
          </Button>
        )}
      </div>

      {/* Status history accordion */}
      {issue.statusChanges.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="history" className="border-0">
            <AccordionTrigger className="py-1 text-xs text-muted-foreground hover:no-underline">
              {t("detailSheet.statusHistory")} ({issue.statusChanges.length})
            </AccordionTrigger>
            <AccordionContent>
              <div className="mt-1 space-y-1.5">
                {issue.statusChanges.map((change) => (
                  <div key={change.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge value={change.status.value} label={change.status.label} />
                    {change.changedBy && <span>{change.changedBy}</span>}
                    <span>{fmtDateTime(change.createdAt)}</span>
                    {change.reason && <span className="italic">"{change.reason}"</span>}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Children (deferred chain) */}
      {issue.children.map((child) => (
        <IssueCard
          key={child.id}
          issue={child}
          storeId={storeId}
          ticketId={ticketId}
          technicians={technicians}
          onReload={onReload}
          depth={depth + 1}
        />
      ))}

      {/* Inline dialogs */}
      <ChangeStatusDialog
        open={activeDialog === "status"}
        issue={issue}
        storeId={storeId}
        ticketId={ticketId}
        onClose={() => setActiveDialog(null)}
        onSuccess={onReload}
      />
      <AssignDialog
        open={activeDialog === "assign"}
        issue={issue}
        storeId={storeId}
        ticketId={ticketId}
        technicians={technicians}
        onClose={() => setActiveDialog(null)}
        onSuccess={onReload}
      />
      <DeferDialog
        open={activeDialog === "defer"}
        issue={issue}
        storeId={storeId}
        ticketId={ticketId}
        onClose={() => setActiveDialog(null)}
        onSuccess={onReload}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main sheet                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export interface TicketDetailSheetProps {
  open: boolean;
  ticketId: number | null;
  storeId: string;
  technicians: CatalogTechnician[];
  onClose: () => void;
}

export function TicketDetailSheet({
  open,
  ticketId,
  storeId,
  technicians,
  onClose,
}: TicketDetailSheetProps) {
  const t = useTranslations("maintenanceTickets");
  const [issuesResponse, setIssuesResponse] = useState<TicketIssuesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalNoteDialogOpen, setFinalNoteDialogOpen] = useState(false);

  const currentNote = issuesResponse?.data?.[0]
    ? null // final note is on the ticket, not issues – pass through separately
    : null;

  const loadIssues = useCallback(async () => {
    if (!ticketId || !storeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await maintenanceTicketsService.getTicketIssues(storeId, ticketId);
      setIssuesResponse(result);
    } catch (err) {
      setError(
        err instanceof MaintenanceTicketsError
          ? err.message
          : t("detailSheet.loadError")
      );
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, storeId, t]);

  useEffect(() => {
    if (open && ticketId) {
      loadIssues();
    } else if (!open) {
      setIssuesResponse(null);
      setError(null);
    }
  }, [open, ticketId, loadIssues]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col gap-0 p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              {t("detailSheet.title")}
              {ticketId && (
                <span className="font-mono text-muted-foreground">#{ticketId}</span>
              )}
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={loadIssues}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
          <SheetDescription>{t("detailSheet.description")}</SheetDescription>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Loading skeleton */}
          {isLoading && !issuesResponse && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-2">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/50 p-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={loadIssues}>
                {t("error.retry")}
              </Button>
            </div>
          )}

          {/* Issues list */}
          {issuesResponse && issuesResponse.data.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              {t("detailSheet.noIssues")}
            </p>
          )}

          {issuesResponse && issuesResponse.data.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              storeId={storeId}
              ticketId={ticketId!}
              technicians={technicians}
              onReload={loadIssues}
            />
          ))}
        </div>

        {/* Footer: final note */}
        <Separator />
        <div className="px-6 py-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setFinalNoteDialogOpen(true)}
            disabled={isLoading || !ticketId}
          >
            <StickyNote className="me-2 h-4 w-4" />
            {t("detailSheet.setFinalNote")}
          </Button>
        </div>

        {/* Final note dialog */}
        {ticketId && (
          <FinalNoteDialog
            open={finalNoteDialogOpen}
            storeId={storeId}
            ticketId={ticketId}
            currentNote={null}
            onClose={() => setFinalNoteDialogOpen(false)}
            onSuccess={loadIssues}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
