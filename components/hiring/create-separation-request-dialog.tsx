"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  AlertCircle,
  Paperclip,
  X,
  Loader2,
  ChevronsUpDown,
  Check,
  FileText,
  Building2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { employeeService } from "@/lib/api/services/employee.service";
import { parseApiError, type ParsedApiError } from "@/lib/api/utils/error";
import { useAuthStore } from "@/lib/auth/auth.store";
import type {
  SeparationType,
  ResignationReason,
  TerminationReason,
} from "@/types/separation.types";
import type { EmployeeV1Record } from "@/types/employee.types";

interface CreateSeparationRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const SEPARATION_TYPES: { value: SeparationType; label: string }[] = [
  { value: "termination", label: "Termination" },
  { value: "resignation", label: "Resignation" },
];

const RESIGNATION_REASONS: { value: ResignationReason; label: string }[] = [
  { value: "found_another_job", label: "Found Another Job" },
  { value: "school_schedule_conflict", label: "School Schedule Conflict" },
  { value: "relocation", label: "Relocation" },
  { value: "personal_reasons", label: "Personal Reasons" },
  { value: "health_family_reasons", label: "Health / Family Reasons" },
  { value: "cognito_form", label: "Cognito Form" },
  { value: "other", label: "Other" },
];

const TERMINATION_REASONS: { value: TerminationReason; label: string }[] = [
  { value: "performance_issues", label: "Performance Issues" },
  { value: "policy_violation_misconduct", label: "Policy Violation / Misconduct" },
  { value: "attendance_issues", label: "Attendance Issues" },
  {
    value: "no_call_no_show_more_than_2_times_job_abandonment",
    label: "No Call / No Show (2+ times) – Job Abandonment",
  },
  { value: "end_of_trial_period", label: "End of Trial Period" },
  { value: "reach_the_limits_of_caps_needed", label: "Reached Caps Needed Limit" },
  { value: "other", label: "Other" },
];

const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;

function NewAttachmentThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImg = IMAGE_EXTS.test(file.name);

  useEffect(() => {
    if (!isImg) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, isImg]);

  if (isImg && url) {
    return (
      <img
        src={url}
        alt={file.name}
        className="h-8 w-8 rounded object-cover shrink-0"
      />
    );
  }
  return (
    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
      <FileText className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

export function CreateSeparationRequestDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateSeparationRequestDialogProps) {
  const { overviewStores } = useAuthStore();

  // Store combobox
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [storeSearch, setStoreSearch] = useState("");
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);

  // Employees
  const [employees, setEmployees] = useState<EmployeeV1Record[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Employee search combobox
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);

  // Form fields
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [finalWorkingDay, setFinalWorkingDay] = useState("");
  const [separationType, setSeparationType] = useState<SeparationType | "">("");

  // Resignation-specific
  const [resignationReason, setResignationReason] = useState<ResignationReason | "">("");
  const [resignationReasonDetails, setResignationReasonDetails] = useState("");

  // Termination-specific
  const [terminationLetter, setTerminationLetter] = useState("");
  const [terminationReason, setTerminationReason] = useState<TerminationReason | "">("");
  const [terminationReasonDetails, setTerminationReasonDetails] = useState("");

  // Shared
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredStores = useMemo(() => {
    const q = storeSearch.toLowerCase();
    if (!q) return overviewStores ?? [];
    return (overviewStores ?? []).filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.storeId ?? "").toLowerCase().includes(q),
    );
  }, [overviewStores, storeSearch]);

  const selectedStoreObj = overviewStores?.find((s) => s.storeId === selectedStoreId);

  // Clear employee when store changes
  useEffect(() => {
    setSelectedEmployeeId("");
    setEmployeeSearch("");
    setEmployees([]);
    setLoadError(null);
  }, [selectedStoreId]);

  // Reset type-specific fields when separation type changes
  useEffect(() => {
    setResignationReason("");
    setResignationReasonDetails("");
    setTerminationLetter("");
    setTerminationReason("");
    setTerminationReasonDetails("");
  }, [separationType]);

  // Reset resignation details when reason is no longer "other"
  useEffect(() => {
    if (resignationReason !== "other") setResignationReasonDetails("");
  }, [resignationReason]);

  // Reset termination details when reason is no longer "other"
  useEffect(() => {
    if (terminationReason !== "other") setTerminationReasonDetails("");
  }, [terminationReason]);

  // Fetch employees when dialog opens and a store is selected
  useEffect(() => {
    if (!open || !selectedStoreId) return;
    let cancelled = false;
    setIsLoadingData(true);
    setLoadError(null);

    employeeService
      .getEmployeesV1(selectedStoreId, {
          per_page: 99,
          status_in: ["hired", "rehired", "OJE"],
        })
      .then((res) => {
        if (cancelled) return;
        setEmployees(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof Error && err.name === "CanceledError") return;
        setLoadError(
          err instanceof Error ? err.message : "Failed to load employees.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedStoreId]);

  const isDirty =
    selectedStoreId !== "" ||
    selectedEmployeeId !== "" ||
    finalWorkingDay !== "" ||
    separationType !== "" ||
    resignationReason !== "" ||
    resignationReasonDetails !== "" ||
    terminationLetter !== "" ||
    terminationReason !== "" ||
    terminationReasonDetails !== "" ||
    additionalNotes !== "" ||
    attachments.length > 0;

  function resetForm() {
    setSelectedStoreId("");
    setStoreSearch("");
    setStoreDropdownOpen(false);
    setSelectedEmployeeId("");
    setEmployeeSearch("");
    setEmployeeDropdownOpen(false);
    setEmployees([]);
    setLoadError(null);
    setFinalWorkingDay("");
    setSeparationType("");
    setResignationReason("");
    setResignationReasonDetails("");
    setTerminationLetter("");
    setTerminationReason("");
    setTerminationReasonDetails("");
    setAdditionalNotes("");
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
      setAttachments((prev) => [...prev, ...Array.from(files)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  const isFormValid =
    selectedStoreId !== "" &&
    selectedEmployeeId !== "" &&
    finalWorkingDay.trim() !== "" &&
    separationType !== "" &&
    (separationType !== "resignation" ||
      (resignationReason !== "" &&
        (resignationReason !== "other" || resignationReasonDetails.trim() !== ""))) &&
    (separationType !== "termination" ||
      (terminationLetter.trim() !== "" &&
        terminationReason !== "" &&
        (terminationReason !== "other" || terminationReasonDetails.trim() !== "")));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await separationService.createSeparationRequest(selectedStoreId, {
        employee_id: Number(selectedEmployeeId),
        final_working_day: finalWorkingDay,
        separation_type: separationType as SeparationType,
        additional_notes: additionalNotes || null,
        attachments: attachments.length > 0 ? attachments : undefined,
        ...(separationType === "resignation"
          ? {
              resignation_reason: resignationReason as ResignationReason,
              resignation_reason_details:
                resignationReason === "other" ? resignationReasonDetails : null,
            }
          : {}),
        ...(separationType === "termination"
          ? {
              termination_letter: terminationLetter,
              termination_reason: terminationReason as TerminationReason,
              termination_reason_details:
                terminationReason === "other" ? terminationReasonDetails : null,
            }
          : {}),
      });

      toast.success("Separation request created successfully.");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "CanceledError") return;
      setError(parseApiError(err, "Failed to create separation request."));
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
              Select a store and employee to initiate a separation workflow.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <span>{error.message}</span>
                  {error.details.length > 0 && (
                    <ul className="mt-1 list-disc ps-4 text-xs space-y-0.5">
                      {error.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* ── Store ── */}
            <div className="space-y-2">
              <Label>
                Store <span className="text-destructive">*</span>
              </Label>
              <Popover
                open={storeDropdownOpen}
                onOpenChange={setStoreDropdownOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={storeDropdownOpen}
                    className="w-full justify-between font-normal h-9 px-3"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm">
                        {selectedStoreObj
                          ? `${selectedStoreObj.name} — ${selectedStoreObj.storeId}`
                          : "Select a store"}
                      </span>
                    </span>
                    <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <div className="border-b p-2">
                    <Input
                      placeholder="Search by name or number…"
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/35">
                    {filteredStores.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No stores found.
                      </p>
                    ) : (
                      filteredStores.map((store) => {
                        const isSelected = store.storeId === selectedStoreId;
                        return (
                          <button
                            key={store.storeId}
                            type="button"
                            className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                              isSelected ? "bg-accent text-accent-foreground" : ""
                            }`}
                            onClick={() => {
                              setSelectedStoreId(store.storeId ?? "");
                              setStoreSearch("");
                              setStoreDropdownOpen(false);
                            }}
                          >
                            <Check
                              className={`h-4 w-4 shrink-0 ${
                                isSelected ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <div className="flex flex-col items-start min-w-0">
                              <span className="font-medium truncate">{store.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {store.storeId}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* ── Employee ── */}
            <div className="space-y-2">
              <Label>
                Employee <span className="text-destructive">*</span>
              </Label>
              <Popover
                open={employeeDropdownOpen}
                onOpenChange={setEmployeeDropdownOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={employeeDropdownOpen}
                    disabled={!selectedStoreId}
                    className="w-full justify-between font-normal h-9 px-3"
                  >
                    <span className="truncate text-sm">
                      {isLoadingData ? (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Loading employees…
                        </span>
                      ) : selectedEmployeeId ? (
                        (() => {
                          const emp = employees.find(
                            (e) => String(e.id) === selectedEmployeeId,
                          );
                          return emp
                            ? `${emp.first_name} ${emp.last_name}`
                            : `Employee #${selectedEmployeeId}`;
                        })()
                      ) : !selectedStoreId ? (
                        "Select a store first"
                      ) : (
                        "Select an employee"
                      )}
                    </span>
                    <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <div className="border-b p-2">
                    <Input
                      placeholder="Search employees…"
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/35" onWheel={(e) => e.stopPropagation()}>
                    {(() => {
                      const filtered = employees.filter((emp) => {
                        if (!employeeSearch.trim()) return true;
                        const q = employeeSearch.toLowerCase();
                        const name = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                        return name.includes(q) || String(emp.id).includes(q);
                      });
                      if (filtered.length === 0) {
                        return (
                          <p className="py-6 text-center text-sm text-muted-foreground">
                            No employees found.
                          </p>
                        );
                      }
                      return filtered.map((emp) => {
                        const name = `${emp.first_name} ${emp.last_name}`;
                        const isSelected = String(emp.id) === selectedEmployeeId;
                        return (
                          <button
                            key={emp.id}
                            type="button"
                            className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                              isSelected
                                ? "bg-accent text-accent-foreground"
                                : ""
                            }`}
                            onClick={() => {
                              setSelectedEmployeeId(String(emp.id));
                              setEmployeeSearch("");
                              setEmployeeDropdownOpen(false);
                            }}
                          >
                            <Check
                              className={`h-4 w-4 shrink-0 ${
                                isSelected ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <span className="truncate">{name}</span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </PopoverContent>
              </Popover>
              {loadError && (
                <p className="text-xs text-destructive">{loadError}</p>
              )}
            </div>

            {/* ── Final Working Day ── */}
            <div className="space-y-2">
              <Label htmlFor="sep-final-working-day">
                Final Working Day <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sep-final-working-day"
                type="date"
                value={finalWorkingDay}
                onChange={(e) => setFinalWorkingDay(e.target.value)}
                required
              />
            </div>

            {/* ── Separation Type ── */}
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

            {/* ── Resignation fields ── */}
            {separationType === "resignation" && (
              <div className="rounded-md border p-4 space-y-4">
                <p className="text-sm font-medium leading-none">
                  Resignation Details
                </p>

                <div className="space-y-2">
                  <Label>
                    Resignation Reason{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={resignationReason}
                    onValueChange={(v) =>
                      setResignationReason(v as ResignationReason)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESIGNATION_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {resignationReason === "other" && (
                  <div className="space-y-2">
                    <Label htmlFor="sep-resignation-details">
                      Resignation Reason Details{" "}
                      <span className="text-destructive">*</span>{" "}
                      <span className="text-muted-foreground text-xs">
                        (max 1000)
                      </span>
                    </Label>
                    <Textarea
                      id="sep-resignation-details"
                      value={resignationReasonDetails}
                      onChange={(e) =>
                        setResignationReasonDetails(e.target.value)
                      }
                      placeholder="Describe the reason…"
                      rows={3}
                      maxLength={1000}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── Termination fields ── */}
            {separationType === "termination" && (
              <div className="rounded-md border p-4 space-y-4">
                <p className="text-sm font-medium leading-none">
                  Termination Details
                </p>

                <div className="space-y-2">
                  <Label htmlFor="sep-termination-letter">
                    Termination Letter{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="sep-termination-letter"
                    value={terminationLetter}
                    onChange={(e) => setTerminationLetter(e.target.value)}
                    placeholder="Letter content…"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Termination Reason{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={terminationReason}
                    onValueChange={(v) =>
                      setTerminationReason(v as TerminationReason)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINATION_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {terminationReason === "other" && (
                  <div className="space-y-2">
                    <Label htmlFor="sep-termination-details">
                      Termination Reason Details{" "}
                      <span className="text-destructive">*</span>{" "}
                      <span className="text-muted-foreground text-xs">
                        (max 1000)
                      </span>
                    </Label>
                    <Textarea
                      id="sep-termination-details"
                      value={terminationReasonDetails}
                      onChange={(e) =>
                        setTerminationReasonDetails(e.target.value)
                      }
                      placeholder="Describe the reason…"
                      rows={3}
                      maxLength={1000}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── Attachments ── */}
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
                  {attachments.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-2 rounded-md border p-2"
                    >
                      <NewAttachmentThumb file={file} />
                      <span className="truncate text-sm flex-1">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0 ms-auto"
                        onClick={() => removeAttachment(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── Additional Notes ── */}
            <div className="space-y-2">
              <Label htmlFor="sep-additional-notes">
                Additional Notes{" "}
                <span className="text-muted-foreground text-xs">(max 2000)</span>
              </Label>
              <Textarea
                id="sep-additional-notes"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Any additional notes…"
                rows={3}
                maxLength={2000}
              />
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
