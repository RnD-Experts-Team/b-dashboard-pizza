"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, X, Paperclip, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  dailyPayService,
  DailyPayError,
} from "@/lib/api/services/daily-pay.service";
import type {
  DailyPayEntry,
  DailyPayEntryInput,
  DailyPayLineInput,
} from "@/types/daily-pay.types";
import type { CatalogTechnician } from "@/types/maintenance-tickets.types";
import type { DailyPayStoreOption } from "@/lib/hooks/use-daily-pay";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Local form state (strings so number inputs can be empty)                */
/* ────────────────────────────────────────────────────────────────────────── */

interface NoteForm {
  body: string;
  type: string;
  files: File[];
}

interface LineForm {
  storeId: string;
  technicianId: string;
  totalWorkingHours: string;
  gas: string;
  invoices: string;
  hourlyPaymentRate: string;
  moneyOwed: string;
  travelTime: string;
  totalBreakTime: string;
  ticketIssueIds: string; // comma-separated integer IDs
  notes: NoteForm[];
  files: File[];
}

function emptyLine(): LineForm {
  return {
    storeId: "",
    technicianId: "",
    totalWorkingHours: "",
    gas: "",
    invoices: "",
    hourlyPaymentRate: "",
    moneyOwed: "",
    travelTime: "",
    totalBreakTime: "",
    ticketIssueIds: "",
    notes: [],
    files: [],
  };
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toNum(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Numeric field                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

function NumField({
  label,
  value,
  onChange,
  prefix,
  step = "0.01",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn("h-9 text-sm", prefix && "ps-6")}
          placeholder="0"
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Dialog                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

interface DailyPayEntryDialogProps {
  open: boolean;
  /** null → create mode; number → edit mode (prefills from detail). */
  entryId: number | null;
  stores: DailyPayStoreOption[];
  technicians: CatalogTechnician[];
  onClose: () => void;
  onSuccess: () => void;
}

export function DailyPayEntryDialog({
  open,
  entryId,
  stores,
  technicians,
  onClose,
  onSuccess,
}: DailyPayEntryDialogProps) {
  const isEdit = entryId != null;

  const [date, setDate] = useState(todayIso());
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [prefillError, setPrefillError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset / prefill whenever the dialog opens.
  useEffect(() => {
    if (!open) return;

    if (!isEdit) {
      setDate(todayIso());
      setLines([emptyLine()]);
      setFormError(null);
      setPrefillError(null);
      return;
    }

    const ctrl = new AbortController();
    setIsPrefilling(true);
    setPrefillError(null);
    setFormError(null);

    dailyPayService
      .getEntry(entryId as number, ctrl.signal)
      .then((entry: DailyPayEntry) => {
        if (ctrl.signal.aborted) return;
        setDate(entry.date);
        setLines(
          entry.lines.length
            ? entry.lines.map((line) => ({
                storeId: String(line.storeId),
                technicianId: String(line.technicianId),
                totalWorkingHours: line.totalWorkingHours?.toString() ?? "",
                gas: line.gas?.toString() ?? "",
                invoices: line.invoices?.toString() ?? "",
                hourlyPaymentRate: line.hourlyPaymentRate?.toString() ?? "",
                moneyOwed: line.moneyOwed?.toString() ?? "",
                travelTime: line.travelTime?.toString() ?? "",
                totalBreakTime: line.totalBreakTime?.toString() ?? "",
                ticketIssueIds: line.ticketIssues.map((ti) => ti.id).join(", "),
                notes: line.notes.map((n) => ({
                  body: n.body,
                  type: n.type ?? "",
                  files: [],
                })),
                files: [],
              }))
            : [emptyLine()]
        );
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof DailyPayError && err.code === "CANCELLED") return;
        setPrefillError(
          err instanceof DailyPayError ? err.message : "Failed to load entry."
        );
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setIsPrefilling(false);
      });

    return () => ctrl.abort();
  }, [open, entryId, isEdit]);

  function updateLine(index: number, patch: Partial<LineForm>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function addNote(lineIndex: number) {
    setLines((prev) =>
      prev.map((l, i) =>
        i === lineIndex ? { ...l, notes: [...l.notes, { body: "", type: "", files: [] }] } : l
      )
    );
  }

  function updateNote(lineIndex: number, noteIndex: number, patch: Partial<NoteForm>) {
    setLines((prev) =>
      prev.map((l, i) =>
        i === lineIndex
          ? {
              ...l,
              notes: l.notes.map((n, j) => (j === noteIndex ? { ...n, ...patch } : n)),
            }
          : l
      )
    );
  }

  function removeNote(lineIndex: number, noteIndex: number) {
    setLines((prev) =>
      prev.map((l, i) =>
        i === lineIndex
          ? { ...l, notes: l.notes.filter((_, j) => j !== noteIndex) }
          : l
      )
    );
  }

  function validate(): DailyPayEntryInput | null {
    if (!date.trim()) {
      setFormError("Workday date is required.");
      return null;
    }
    if (lines.length === 0) {
      setFormError("At least one line is required.");
      return null;
    }

    const builtLines: DailyPayLineInput[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const storeId = toNum(line.storeId);
      const technicianId = toNum(line.technicianId);
      if (storeId == null) {
        setFormError(`Line ${i + 1}: store is required.`);
        return null;
      }
      if (technicianId == null) {
        setFormError(`Line ${i + 1}: technician is required.`);
        return null;
      }

      const ticketIssueIds = line.ticketIssueIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0);

      const notes = line.notes
        .filter((n) => n.body.trim())
        .map((n) => ({
          body: n.body.trim(),
          type: n.type.trim() || undefined,
          files: n.files,
        }));

      builtLines.push({
        storeId,
        technicianId,
        totalWorkingHours: toNum(line.totalWorkingHours),
        gas: toNum(line.gas),
        invoices: toNum(line.invoices),
        hourlyPaymentRate: toNum(line.hourlyPaymentRate),
        moneyOwed: toNum(line.moneyOwed),
        travelTime: toNum(line.travelTime),
        totalBreakTime: toNum(line.totalBreakTime),
        ticketIssueIds: ticketIssueIds.length ? ticketIssueIds : undefined,
        notes: notes.length ? notes : undefined,
        files: line.files.length ? line.files : undefined,
      });
    }

    return { date: date.trim(), lines: builtLines };
  }

  async function handleSubmit() {
    setFormError(null);
    const payload = validate();
    if (!payload) return;

    setIsSubmitting(true);
    try {
      if (isEdit) {
        await dailyPayService.editEntry(entryId as number, payload);
        toast.success("Daily pay entry updated.");
      } else {
        await dailyPayService.createEntry(payload);
        toast.success("Daily pay entry created.");
      }
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof DailyPayError && err.code === "CANCELLED") return;
      if (err instanceof DailyPayError && err.validationErrors) {
        const first = Object.values(err.validationErrors)[0]?.[0];
        toast.error(first || err.message);
      } else {
        toast.error(
          err instanceof DailyPayError ? err.message : "Failed to save entry."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit Daily Pay Entry #${entryId}` : "New Daily Pay Entry"}
          </DialogTitle>
          <DialogDescription>
            One line per technician × store worked this day.
            {isEdit &&
              " Saving replaces the full entry; the previous state is kept as a revision."}
          </DialogDescription>
        </DialogHeader>

        {isPrefilling ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
            Loading entry…
          </div>
        ) : prefillError ? (
          <div className="py-8 text-center text-sm text-destructive">{prefillError}</div>
        ) : (
          <div className="space-y-4">
            {/* Date */}
            <div className="space-y-1 sm:max-w-xs">
              <Label className="text-sm">
                Workday date <span className="text-destructive">*</span>
              </Label>
              <DatePicker value={date} onChange={setDate} disabled={isSubmitting} />
            </div>

            <Separator />

            {/* Lines */}
            <div className="space-y-3">
              {lines.map((line, i) => (
                <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Line {i + 1}</h4>
                    {lines.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(i)}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Store + technician */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Store <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={line.storeId || undefined}
                        onValueChange={(v) => updateLine(i, { storeId: v })}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select store" />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          style={{ maxHeight: "220px", overflowY: "auto" }}
                        >
                          {stores.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.storeNumber}
                              <span className="ms-1.5 text-xs text-muted-foreground">
                                {s.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Technician <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={line.technicianId || undefined}
                        onValueChange={(v) => updateLine(i, { technicianId: v })}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select technician" />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          style={{ maxHeight: "220px", overflowY: "auto" }}
                        >
                          {technicians.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name}
                              {t.categoryName && (
                                <span className="ms-1.5 text-xs text-muted-foreground">
                                  · {t.categoryName}
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Numeric fields */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <NumField label="Working hours" value={line.totalWorkingHours} onChange={(v) => updateLine(i, { totalWorkingHours: v })} disabled={isSubmitting} />
                    <NumField label="Break time" value={line.totalBreakTime} onChange={(v) => updateLine(i, { totalBreakTime: v })} disabled={isSubmitting} />
                    <NumField label="Travel time" value={line.travelTime} onChange={(v) => updateLine(i, { travelTime: v })} disabled={isSubmitting} />
                    <NumField label="Hourly rate" value={line.hourlyPaymentRate} onChange={(v) => updateLine(i, { hourlyPaymentRate: v })} prefix="$" disabled={isSubmitting} />
                    <NumField label="Gas" value={line.gas} onChange={(v) => updateLine(i, { gas: v })} prefix="$" disabled={isSubmitting} />
                    <NumField label="Invoices" value={line.invoices} onChange={(v) => updateLine(i, { invoices: v })} prefix="$" disabled={isSubmitting} />
                    <NumField label="Money owed" value={line.moneyOwed} onChange={(v) => updateLine(i, { moneyOwed: v })} prefix="$" disabled={isSubmitting} />
                  </div>

                  {/* Linked ticket issues */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Linked ticket issue IDs (optional)
                    </Label>
                    <Input
                      value={line.ticketIssueIds}
                      onChange={(e) => updateLine(i, { ticketIssueIds: e.target.value })}
                      placeholder="e.g. 12, 34"
                      disabled={isSubmitting}
                      className="h-9 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      The technician must already be assigned to each linked issue.
                    </p>
                  </div>

                  {/* Files */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" />
                      Attachments (optional)
                    </Label>
                    <Input
                      type="file"
                      multiple
                      onChange={(e) =>
                        updateLine(i, { files: Array.from(e.target.files ?? []) })
                      }
                      disabled={isSubmitting}
                      className="h-9 text-sm"
                    />
                    {line.files.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {line.files.map((f, fi) => (
                          <span
                            key={fi}
                            className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs"
                          >
                            {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    {line.notes.map((note, ni) => (
                      <div key={ni} className="rounded-md border bg-muted/30 p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <StickyNote className="h-3.5 w-3.5" />
                            Note {ni + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
                            onClick={() => removeNote(i, ni)}
                            disabled={isSubmitting}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <Textarea
                          value={note.body}
                          onChange={(e) => updateNote(i, ni, { body: e.target.value })}
                          placeholder="Note body…"
                          disabled={isSubmitting}
                          className="min-h-16 resize-none text-sm"
                        />
                        <Input
                          type="file"
                          multiple
                          onChange={(e) =>
                            updateNote(i, ni, { files: Array.from(e.target.files ?? []) })
                          }
                          disabled={isSubmitting}
                          className="h-8 text-xs"
                        />
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => addNote(i)}
                      disabled={isSubmitting}
                    >
                      <Plus className="h-3 w-3" />
                      Add note
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={addLine}
                disabled={isSubmitting}
              >
                <Plus className="h-4 w-4" />
                Add line
              </Button>
            </div>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isPrefilling || !!prefillError}
          >
            {isSubmitting && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
