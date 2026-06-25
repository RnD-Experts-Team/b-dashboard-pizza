"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  AlertCircle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { hiringService } from "@/lib/api/services/hiring.service";
import { parseApiError, type ParsedApiError } from "@/lib/api/utils/error";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type {
  HiringCandidate,
  NewHire,
  AvailabilityNeeded,
  ShiftRecord,
} from "@/types/hiring.types";

interface EditHiringRequestDialogProps {
  requestId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const emptyCandidate = (): HiringCandidate => ({
  name: "",
  email: "",
  contact_number: "",
  notes: "",
});

const emptyNewHire = (): NewHire => ({
  availability_needed: "open_availability",
  shift_id: 0,
  notes: "",
});

export function EditHiringRequestDialog({
  requestId,
  open,
  onOpenChange,
  onSuccess,
}: EditHiringRequestDialogProps) {
  const { selectedStore } = useSelectedStoreStore();

  const [desiredStartDate, setDesiredStartDate] = useState("");
  const [candidates, setCandidates] = useState<HiringCandidate[]>([emptyCandidate()]);
  const [newHires, setNewHires] = useState<NewHire[]>([emptyNewHire()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(false);

  const resetForm = useCallback(() => {
    setDesiredStartDate("");
    setCandidates([emptyCandidate()]);
    setNewHires([emptyNewHire()]);
    setError(null);
    setIsDirty(false);
  }, []);

  /* Load existing data when dialog opens */
  useEffect(() => {
    if (!open || requestId === null || !selectedStore?.storeId) return;

    let cancelled = false;
    setIsLoadingData(true);
    setError(null);

    hiringService
      .getHiringRequest(selectedStore.storeId, requestId)
      .then((record) => {
        if (cancelled) return;
        setDesiredStartDate(record.desired_start_date);
        setCandidates(
          record.candidates.map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            contact_number: c.contact_number,
            notes: c.notes ?? "",
          })),
        );
        setNewHires(
          record.new_hires.map((h) => ({
            id: h.id,
            availability_needed: h.availability_needed,
            shift_id: h.shift_id,
            notes: h.notes ?? "",
          })),
        );
        setIsDirty(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(parseApiError(err, "Failed to load request data."));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, requestId, selectedStore?.storeId]);

  /* Load shifts for the selected store */
  useEffect(() => {
    if (!open || !selectedStore?.storeId) return;
    let cancelled = false;
    setIsLoadingShifts(true);
    hiringService
      .getCreateEmployeePage(selectedStore.storeId)
      .then((data) => { if (!cancelled) setShifts(data.shifts); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoadingShifts(false); });
    return () => { cancelled = true; };
  }, [open, selectedStore?.storeId]);

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

  function markDirty() {
    if (!isDirty) setIsDirty(true);
  }

  /* ── Candidate helpers ── */
  function updateCandidate(
    index: number,
    field: keyof HiringCandidate,
    value: string,
  ) {
    markDirty();
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  }

  function addCandidate() {
    markDirty();
    setCandidates((prev) => [...prev, emptyCandidate()]);
  }

  function removeCandidate(index: number) {
    markDirty();
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  }

  /* ── New-hire helpers ── */
  function updateNewHire(
    index: number,
    field: keyof NewHire,
    value: string | number,
  ) {
    markDirty();
    setNewHires((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)),
    );
  }

  function addNewHire() {
    markDirty();
    setNewHires((prev) => [...prev, emptyNewHire()]);
  }

  function removeNewHire(index: number) {
    markDirty();
    setNewHires((prev) => prev.filter((_, i) => i !== index));
  }

  /* ── Validation ── */
  const isFormValid =
    desiredStartDate.trim() !== "" &&
    candidates.length > 0 &&
    candidates.every(
      (c) =>
        c.name.trim() !== "" &&
        c.email.trim() !== "" &&
        c.contact_number.trim() !== "",
    ) &&
    newHires.length > 0 &&
    newHires.every((h) => h.shift_id > 0);

  /* ── Submit ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || requestId === null) return;

    if (!selectedStore?.storeId) {
      setError({ message: "No store selected. Please select a store from the sidebar.", details: [] });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await hiringService.updateHiringRequest(selectedStore.storeId, requestId, {
        desired_start_date: desiredStartDate,
        candidates: candidates.map(({ id, name, email, contact_number, notes }) => ({
          ...(id ? { id } : {}),
          name: name.trim(),
          email: email.trim(),
          contact_number: contact_number.trim(),
          ...(notes?.trim() ? { notes: notes.trim() } : {}),
        })),
        new_hires: newHires.map(({ id, availability_needed, shift_id, notes }) => ({
          ...(id ? { id } : {}),
          availability_needed,
          shift_id: Number(shift_id),
          ...(notes?.trim() ? { notes: notes.trim() } : {}),
        })),
      });

      toast.success("Hiring request updated successfully.");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(parseApiError(err, "Failed to update hiring request."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex w-full max-w-3xl flex-col max-h-[90vh] overflow-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit Hiring Request #{requestId}
          </DialogTitle>
          <DialogDescription>
            Update the hiring request for{" "}
            {selectedStore?.name ?? "your store"}.
          </DialogDescription>
        </DialogHeader>

        {isLoadingData ? (
          <div className="space-y-4 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <ScrollArea className="flex-1 px-1">
            <div className="space-y-6 py-2 pe-3">
              {/* Error banner */}
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

              {/* ── Desired Start Date ── */}
              <div className="space-y-2">
                <Label htmlFor="edit_desired_start_date">
                  Desired Start Date{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit_desired_start_date"
                  type="date"
                  value={desiredStartDate}
                  onChange={(e) => {
                    markDirty();
                    setDesiredStartDate(e.target.value);
                  }}
                  required
                  className="max-w-xs"
                />
              </div>

              <Separator />

              {/* ── Candidates ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Candidates</p>
                    <p className="text-xs text-muted-foreground">
                      People to be considered for hiring.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCandidate}
                  >
                    <Plus className="me-1 h-4 w-4" />
                    Add
                  </Button>
                </div>

                <div className="space-y-4">
                  {candidates.map((candidate, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">
                          Candidate {idx + 1}
                        </Badge>
                        {candidates.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeCandidate(idx)}
                            aria-label="Remove candidate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`ec-name-${idx}`}>
                            Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`ec-name-${idx}`}
                            value={candidate.name}
                            onChange={(e) =>
                              updateCandidate(idx, "name", e.target.value)
                            }
                            placeholder="Full name"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`ec-email-${idx}`}>
                            Email <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`ec-email-${idx}`}
                            type="email"
                            value={candidate.email}
                            onChange={(e) =>
                              updateCandidate(idx, "email", e.target.value)
                            }
                            placeholder="email@example.com"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`ec-phone-${idx}`}>
                            Contact Number{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`ec-phone-${idx}`}
                            value={candidate.contact_number}
                            onChange={(e) =>
                              updateCandidate(
                                idx,
                                "contact_number",
                                e.target.value,
                              )
                            }
                            placeholder="+1 555 000 0000"
                            required
                          />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`ec-notes-${idx}`}>Notes</Label>
                          <Input
                            id={`ec-notes-${idx}`}
                            value={candidate.notes ?? ""}
                            onChange={(e) =>
                              updateCandidate(idx, "notes", e.target.value)
                            }
                            placeholder="Optional notes"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* ── New Hires ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">New Hires</p>
                    <p className="text-xs text-muted-foreground">
                      Positions and shift requirements.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addNewHire}
                  >
                    <Plus className="me-1 h-4 w-4" />
                    Add
                  </Button>
                </div>

                <div className="space-y-4">
                  {newHires.map((hire, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">Position {idx + 1}</Badge>
                        {newHires.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeNewHire(idx)}
                            aria-label="Remove position"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`eh-avail-${idx}`}>
                            Availability Needed{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={hire.availability_needed}
                            onValueChange={(v) =>
                              updateNewHire(
                                idx,
                                "availability_needed",
                                v as AvailabilityNeeded,
                              )
                            }
                          >
                            <SelectTrigger id={`eh-avail-${idx}`}>
                              <SelectValue placeholder="Select availability" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekday">Weekday</SelectItem>
                              <SelectItem value="weekends">Weekends</SelectItem>
                              <SelectItem value="open_availability">Open Availability</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`eh-shift-${idx}`}>
                            Shift{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={hire.shift_id > 0 ? hire.shift_id.toString() : ""}
                            onValueChange={(v) =>
                              updateNewHire(idx, "shift_id", parseInt(v, 10))
                            }
                            disabled={isLoadingShifts}
                          >
                            <SelectTrigger id={`eh-shift-${idx}`}>
                              <SelectValue
                                placeholder={
                                  isLoadingShifts ? "Loading shifts…" : "Select a shift"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {shifts.map((s) => (
                                <SelectItem key={s.id} value={s.id.toString()}>
                                  {s.shift}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`eh-notes-${idx}`}>Notes</Label>
                          <Input
                            id={`eh-notes-${idx}`}
                            value={hire.notes ?? ""}
                            onChange={(e) =>
                              updateNewHire(idx, "notes", e.target.value)
                            }
                            placeholder="Optional notes"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>

    {/* Exit confirmation */}
    <AlertDialog open={showConfirmExit} onOpenChange={setShowConfirmExit}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. If you close now, all entered data will be
            lost. Are you sure you want to exit?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Editing</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={confirmExit}
          >
            Discard &amp; Close
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
