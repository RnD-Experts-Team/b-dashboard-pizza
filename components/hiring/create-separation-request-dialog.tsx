"use client";

import { useState, useRef, useEffect } from "react";
import {
  AlertCircle,
  Paperclip,
  X,
  Loader2,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { separationService } from "@/lib/api/services/separation.service";
import { hiringService } from "@/lib/api/services/hiring.service";
import { employeeService } from "@/lib/api/services/employee.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type {
  SeparationReasonType,
  SeparationType,
  SeparationReasonRecord,
  SeparationAttachmentInput,
} from "@/types/separation.types";
import type { EmployeeRecord } from "@/types/employee.types";

interface CreateSeparationRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const SEPARATION_TYPES: { value: SeparationType; label: string }[] = [
  { value: "termination", label: "Termination" },
  { value: "resignation", label: "Resignation" },
];

export function CreateSeparationRequestDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateSeparationRequestDialogProps) {
  const { selectedStore } = useSelectedStoreStore();

  // Dropdown data
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [separationReasons, setSeparationReasons] = useState<SeparationReasonRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form fields
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [finalWorkDate, setFinalWorkDate] = useState("");
  const [separationType, setSeparationType] = useState<SeparationType | "">("");
  const [reasonType, setReasonType] = useState<SeparationReasonType | "">("");
  const [reasonId, setReasonId] = useState<string>("");
  const [reasonTitle, setReasonTitle] = useState("");
  const [otherNotes, setOtherNotes] = useState("");
  const [terminationLetter, setTerminationLetter] = useState("");
  const [attachments, setAttachments] = useState<{ file: File; note: string }[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch employees + separation reasons when dialog opens
  useEffect(() => {
    if (!open || !selectedStore?.storeId) return;
    let cancelled = false;
    setIsLoadingData(true);
    setLoadError(null);

    Promise.all([
      employeeService.getEmployees(selectedStore.storeId),
      hiringService.getCreateEmployeePage(selectedStore.storeId),
    ])
      .then(([empRes, pageData]) => {
        if (cancelled) return;
        setEmployees(empRes.data.employees);
        setSeparationReasons(pageData.separationReasons as SeparationReasonRecord[]);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof Error && err.name === "CanceledError") return;
        setLoadError(
          err instanceof Error ? err.message : "Failed to load form data.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedStore?.storeId]);

  // When separation type changes, auto-set reason_type to match and reset reason selection
  useEffect(() => {
    if (separationType === "termination" || separationType === "resignation") {
      setReasonType(separationType);
      setReasonId("");
    }
  }, [separationType]);

  // Filter reasons based on selected reason type
  const filteredReasons = separationReasons.filter(
    (r) => r.reason_type === reasonType,
  );

  const isDirty =
    selectedEmployeeId !== "" ||
    finalWorkDate !== "" ||
    reasonType !== "" ||
    separationType !== "" ||
    reasonTitle !== "" ||
    otherNotes !== "" ||
    terminationLetter !== "" ||
    attachments.length > 0;

  function resetForm() {
    setSelectedEmployeeId("");
    setFinalWorkDate("");
    setReasonType("");
    setSeparationType("");
    setReasonId("");
    setReasonTitle("");
    setOtherNotes("");
    setTerminationLetter("");
    setAttachments([]);
    setError(null);
  }

  function handleClose() {
    if (isDirty && !isSubmitting) {
      setShowConfirmExit(true);
      return;
    }
    resetForm();
    onOpenChange(false);
  }

  function confirmExit() {
    setShowConfirmExit(false);
    resetForm();
    onOpenChange(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files) {
      setAttachments((prev) => [
        ...prev,
        ...Array.from(files).map((f) => ({ file: f, note: "" })),
      ]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAttachmentNote(index: number, note: string) {
    setAttachments((prev) =>
      prev.map((a, i) => (i === index ? { ...a, note } : a)),
    );
  }

  const isFormValid =
    selectedEmployeeId !== "" &&
    finalWorkDate.trim() !== "" &&
    separationType !== "" &&
    reasonType !== "" &&
    // reason_id required unless reason_type is "other"
    (reasonType === "other" || reasonId !== "") &&
    // termination_letter required if separation_type is "termination"
    (separationType !== "termination" || terminationLetter.trim() !== "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;

    if (!selectedStore?.storeId) {
      setError("No store selected. Please select a store from the sidebar.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const attPayload: SeparationAttachmentInput[] | undefined =
        attachments.length > 0
          ? attachments.map((a) => ({
              file: a.file,
              note: a.note || null,
            }))
          : undefined;

      await separationService.createSeparationRequest(
        selectedStore.storeId,
        Number(selectedEmployeeId),
        {
          final_work_date: finalWorkDate,
          reason_type: reasonType as SeparationReasonType,
          separation_type: separationType as SeparationType,
          reason_id: reasonType !== "other" && reasonId ? Number(reasonId) : null,
          reason_title: reasonTitle || undefined,
          other_notes: otherNotes || undefined,
          termination_letter:
            separationType === "termination" ? terminationLetter : undefined,
          attachments: attPayload,
        },
      );

      toast.success("Separation request created successfully.");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "CanceledError") return;
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create separation request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Separation Request</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new separation request.
            </DialogDescription>
          </DialogHeader>

          {/* Load error */}
          {loadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
                <span>{loadError}</span>
              </AlertDescription>
            </Alert>
          )}

          {isLoadingData ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading form data…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Employee */}
              <div className="space-y-2">
                <Label>
                  Employee <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedEmployeeId}
                  onValueChange={setSelectedEmployeeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => {
                      const name = emp.employee_profile
                        ? `${emp.employee_profile.first_name} ${emp.employee_profile.last_name}`
                        : `Employee #${emp.id}`;
                      return (
                        <SelectItem key={emp.id} value={String(emp.id)}>
                          {name}
                        </SelectItem>
                      );
                    })}
                    {employees.length === 0 && (
                      <SelectItem value="_none" disabled>
                        No employees found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Final Work Date */}
              <div className="space-y-2">
                <Label htmlFor="sep-final-work-date">
                  Final Work Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sep-final-work-date"
                  type="date"
                  value={finalWorkDate}
                  onChange={(e) => setFinalWorkDate(e.target.value)}
                  required
                />
              </div>

              {/* Separation Type */}
              <div className="space-y-2">
                <Label>
                  Separation Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={separationType}
                  onValueChange={(v) => setSeparationType(v as SeparationType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select separation type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEPARATION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reason (dropdown from API, filtered by reason_type) */}
              {reasonType !== "" && reasonType !== "other" && (
                <div className="space-y-2">
                  <Label>
                    Reason <span className="text-destructive">*</span>
                  </Label>
                  <Select value={reasonId} onValueChange={setReasonId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredReasons.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.reason_title}
                        </SelectItem>
                      ))}
                      {filteredReasons.length === 0 && (
                        <SelectItem value="_none" disabled>
                          No reasons available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* "Other" reason checkbox */}
              {separationType !== "" && (
                <div className="flex items-center gap-2">
                  <input
                    id="sep-reason-other"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={reasonType === "other"}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setReasonType("other");
                        setReasonId("");
                      } else {
                        setReasonType(separationType as SeparationReasonType);
                      }
                    }}
                  />
                  <Label htmlFor="sep-reason-other" className="text-sm font-normal">
                    Other reason (specify below)
                  </Label>
                </div>
              )}

              {/* Reason Title — shown when reason_type is "other" */}
              {reasonType === "other" && (
                <div className="space-y-2">
                  <Label htmlFor="sep-reason-title">
                    Reason Title{" "}
                    <span className="text-muted-foreground text-xs">(max 255)</span>
                  </Label>
                  <Input
                    id="sep-reason-title"
                    value={reasonTitle}
                    onChange={(e) => setReasonTitle(e.target.value)}
                    placeholder="Brief title for the reason"
                    maxLength={255}
                  />
                </div>
              )}

              {/* Termination Letter — required when separation_type = termination */}
              {separationType === "termination" && (
                <div className="space-y-2">
                  <Label htmlFor="sep-termination-letter">
                    Termination Letter{" "}
                    <span className="text-destructive">*</span>
                    <span className="text-muted-foreground text-xs ms-1">
                      (URL, max 255)
                    </span>
                  </Label>
                  <Input
                    id="sep-termination-letter"
                    value={terminationLetter}
                    onChange={(e) => setTerminationLetter(e.target.value)}
                    placeholder="https://..."
                    maxLength={255}
                  />
                </div>
              )}

              {/* Other Notes */}
              <div className="space-y-2">
                <Label htmlFor="sep-other-notes">
                  Other Notes{" "}
                  <span className="text-muted-foreground text-xs">(max 255)</span>
                </Label>
                <Textarea
                  id="sep-other-notes"
                  value={otherNotes}
                  onChange={(e) => setOtherNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={3}
                  maxLength={255}
                />
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <Label>Attachments</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="me-2 h-4 w-4" />
                    Add Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                {attachments.length > 0 && (
                  <ul className="space-y-2 mt-2">
                    {attachments.map((att, i) => (
                      <li
                        key={`${att.file.name}-${i}`}
                        className="flex flex-col gap-1 rounded-md border p-2"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm">{att.file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0 ms-auto"
                            onClick={() => removeAttachment(i)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Note (optional, max 255)"
                          value={att.note}
                          onChange={(e) => updateAttachmentNote(i, e.target.value)}
                          maxLength={255}
                          className="h-8 text-xs"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!isFormValid || isSubmitting}>
                  {isSubmitting ? "Submitting…" : "Create Request"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Unsaved changes confirmation */}
      <AlertDialog open={showConfirmExit} onOpenChange={setShowConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
