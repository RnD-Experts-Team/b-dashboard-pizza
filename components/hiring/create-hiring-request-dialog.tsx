"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  UserPlus,
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
import { toast } from "sonner";
import { hiringService } from "@/lib/api/services/hiring.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type {
  HiringCandidate,
  NewHire,
  AvailabilityNeeded,
  ShiftRecord,
} from "@/types/hiring.types";

interface CreateHiringRequestDialogProps {
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

export function CreateHiringRequestDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateHiringRequestDialogProps) {
  const { selectedStore } = useSelectedStoreStore();

  const [desiredStartDate, setDesiredStartDate] = useState("");
  const [candidates, setCandidates] = useState<HiringCandidate[]>([
    emptyCandidate(),
  ]);
  const [newHires, setNewHires] = useState<NewHire[]>([emptyNewHire()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(false);

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

  /* True when the user has touched anything in the form */
  const isDirty =
    desiredStartDate !== "" ||
    candidates.some(
      (c) => c.name !== "" || c.email !== "" || c.contact_number !== "" || (c.notes ?? "") !== "",
    ) ||
    newHires.some((h) => h.shift_id !== 0 || (h.notes ?? "") !== "");

  function resetForm() {
    setDesiredStartDate("");
    setCandidates([emptyCandidate()]);
    setNewHires([emptyNewHire()]);
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

  /* ── Candidate helpers ── */
  function updateCandidate(
    index: number,
    field: keyof HiringCandidate,
    value: string,
  ) {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  }

  function addCandidate() {
    setCandidates((prev) => [...prev, emptyCandidate()]);
  }

  function removeCandidate(index: number) {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  }

  /* ── New-hire helpers ── */
  function updateNewHire(
    index: number,
    field: keyof NewHire,
    value: string | number,
  ) {
    setNewHires((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)),
    );
  }

  function addNewHire() {
    setNewHires((prev) => [...prev, emptyNewHire()]);
  }

  function removeNewHire(index: number) {
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
    if (!isFormValid) return;

    if (!selectedStore?.storeId) {
      setError("No store selected. Please select a store from the sidebar.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await hiringService.createHiringRequest(selectedStore.storeId, {
        desired_start_date: desiredStartDate,
        candidates: candidates.map(({ name, email, contact_number, notes }) => ({
          name: name.trim(),
          email: email.trim(),
          contact_number: contact_number.trim(),
          ...(notes?.trim() ? { notes: notes.trim() } : {}),
        })),
        new_hires: newHires.map(({ availability_needed, shift_id, notes }) => ({
          availability_needed,
          shift_id: Number(shift_id),
          ...(notes?.trim() ? { notes: notes.trim() } : {}),
        })),
      });

      toast.success("Hiring request created successfully.");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create hiring request.",
      );
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
            <UserPlus className="h-5 w-5 text-primary" />
            Create Hiring Request
          </DialogTitle>
          <DialogDescription>
            Submit a new hiring request for{" "}
            {selectedStore?.name ?? "your store"}.
          </DialogDescription>
        </DialogHeader>

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
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* ── Desired Start Date ── */}
              <div className="space-y-2">
                <Label htmlFor="desired_start_date">
                  Desired Start Date{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="desired_start_date"
                  type="date"
                  value={desiredStartDate}
                  onChange={(e) => setDesiredStartDate(e.target.value)}
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
                          <Label htmlFor={`c-name-${idx}`}>
                            Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`c-name-${idx}`}
                            value={candidate.name}
                            onChange={(e) =>
                              updateCandidate(idx, "name", e.target.value)
                            }
                            placeholder="Full name"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`c-email-${idx}`}>
                            Email <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`c-email-${idx}`}
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
                          <Label htmlFor={`c-phone-${idx}`}>
                            Contact Number{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`c-phone-${idx}`}
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
                          <Label htmlFor={`c-notes-${idx}`}>Notes</Label>
                          <Input
                            id={`c-notes-${idx}`}
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
                          <Label htmlFor={`h-avail-${idx}`}>
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
                            <SelectTrigger id={`h-avail-${idx}`}>
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
                          <Label htmlFor={`h-shift-${idx}`}>
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
                            <SelectTrigger id={`h-shift-${idx}`}>
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
                          <Label htmlFor={`h-notes-${idx}`}>Notes</Label>
                          <Input
                            id={`h-notes-${idx}`}
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
              {isSubmitting ? "Submitting…" : "Create Request"}
            </Button>
          </DialogFooter>
        </form>
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
