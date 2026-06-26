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
import { Textarea } from "@/components/ui/textarea";
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
import { parseApiError, type ParsedApiError } from "@/lib/api/utils/error";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type {
  AvailabilityType,
  ShiftType,
  HiringRequestPositionInput,
  HiringRequestCandidateInput,
} from "@/types/hiring.types";

interface CreateHiringRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const AVAILABILITY_OPTIONS: { value: AvailabilityType; label: string }[] = [
  { value: "weekday", label: "Weekday" },
  { value: "weekend", label: "Weekend" },
  { value: "open_availability", label: "Open Availability" },
];

const SHIFT_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
  { value: "OP", label: "OP (Opening)" },
];

const emptyPosition = (): HiringRequestPositionInput => ({
  availability_type: "open_availability",
  shift_type: "AM",
  notes: "",
});

const emptyCandidate = (): HiringRequestCandidateInput => ({
  name: "",
  email: "",
  phone: "",
});

export function CreateHiringRequestDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateHiringRequestDialogProps) {
  const { selectedStore } = useSelectedStoreStore();

  const [desiredStartDate, setDesiredStartDate] = useState("");
  const [employeesNeeded, setEmployeesNeeded] = useState<number>(1);
  const [positions, setPositions] = useState<HiringRequestPositionInput[]>([emptyPosition()]);
  const [candidates, setCandidates] = useState<HiringRequestCandidateInput[]>([]);
  const [finalNotes, setFinalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);

  // Auto-sync positions count = employeesNeeded - candidates.length
  useEffect(() => {
    const needed = Math.max(0, employeesNeeded - candidates.length);
    setPositions((prev) => {
      if (prev.length === needed) return prev;
      if (prev.length < needed) {
        return [...prev, ...Array.from({ length: needed - prev.length }, emptyPosition)];
      }
      return prev.slice(0, needed);
    });
  }, [employeesNeeded, candidates.length]);

  const isDirty =
    desiredStartDate !== "" ||
    employeesNeeded !== 1 ||
    positions.some((p) => p.notes !== "") ||
    candidates.length > 0 ||
    finalNotes !== "";

  function resetForm() {
    setDesiredStartDate("");
    setEmployeesNeeded(1);
    setPositions([emptyPosition()]);
    setCandidates([]);
    setFinalNotes("");
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

  /* â”€â”€ Position helpers â”€â”€ */
  function updatePosition(
    index: number,
    field: keyof HiringRequestPositionInput,
    value: string,
  ) {
    setPositions((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  }

  /* â”€â”€ Candidate helpers â”€â”€ */
  function updateCandidate(
    index: number,
    field: keyof HiringRequestCandidateInput,
    value: string,
  ) {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  }

  function addCandidate() {
    if (candidates.length >= employeesNeeded) return;
    setCandidates((prev) => [...prev, emptyCandidate()]);
  }

  function removeCandidate(index: number) {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  }

  /* â”€â”€ Validation â”€â”€ */
  const positionsCountOk = positions.length === employeesNeeded - candidates.length;

  const isFormValid =
    desiredStartDate.trim() !== "" &&
    employeesNeeded >= 1 &&
    positionsCountOk &&
    positions.every(
      (p) => p.availability_type && p.shift_type && p.notes.trim() !== "",
    ) &&
    candidates.every(
      (c) => c.name.trim() !== "" && c.email.trim() !== "" && c.phone.trim() !== "",
    );

  /* â”€â”€ Submit â”€â”€ */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;

    if (!selectedStore?.storeId) {
      setError({ message: "No store selected. Please select a store from the sidebar.", details: [] });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await hiringService.createHiringRequest(selectedStore.storeId, {
        desired_start_date: desiredStartDate,
        employees_needed: employeesNeeded,
        positions: positions.map((p) => ({
          availability_type: p.availability_type,
          shift_type: p.shift_type,
          notes: p.notes.trim(),
        })),
        candidates:
          candidates.length > 0
            ? candidates.map((c) => ({
                name: c.name.trim(),
                email: c.email.trim(),
                phone: c.phone.trim(),
              }))
            : undefined,
        final_notes: finalNotes.trim() || null,
      });

      toast.success("Hiring request created successfully.");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(parseApiError(err, "Failed to create hiring request."));
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

              {/* â”€â”€ Desired Start Date + Employees Needed â”€â”€ */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employees_needed">
                    Employees Needed{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="employees_needed"
                    type="number"
                    min={1}
                    value={employeesNeeded}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 1) setEmployeesNeeded(v);
                    }}
                    required
                  />
                </div>
              </div>

              <Separator />

              {/* â”€â”€ Candidates (optional) â”€â”€ */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      Candidates{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pre-identified candidates &mdash; max{" "}
                      <span className="font-medium text-foreground">{employeesNeeded}</span>.
                      Remaining slots become positions.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCandidate}
                    disabled={candidates.length >= employeesNeeded}
                  >
                    <Plus className="me-1 h-4 w-4" />
                    Add
                  </Button>
                </div>

                {candidates.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    No candidates added. All {employeesNeeded} slot
                    {employeesNeeded !== 1 ? "s" : ""} will be open positions.
                  </p>
                )}

                {candidates.length > 0 && (
                  <div className="space-y-4">
                    {candidates.map((candidate, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">Candidate {idx + 1}</Badge>
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
                              maxLength={255}
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
                              maxLength={255}
                              required
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor={`c-phone-${idx}`}>
                              Phone <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id={`c-phone-${idx}`}
                              value={candidate.phone}
                              onChange={(e) =>
                                updateCandidate(idx, "phone", e.target.value)
                              }
                              placeholder="+1 555 000 0000"
                              maxLength={20}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* â”€â”€ Positions â”€â”€ */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Positions</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{positions.length}</span>{" "}
                      open position{positions.length !== 1 ? "s" : ""}{" "}
                      &mdash; {employeesNeeded} needed &minus; {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {positions.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    All slots are filled by candidates.
                  </p>
                )}

                {positions.length > 0 && (
                  <div className="space-y-4">
                    {positions.map((position, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border p-4 space-y-3"
                      >
                        <Badge variant="secondary">Position {idx + 1}</Badge>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`p-avail-${idx}`}>
                              Availability Type{" "}
                              <span className="text-destructive">*</span>
                            </Label>
                            <Select
                              value={position.availability_type}
                              onValueChange={(v) =>
                                updatePosition(idx, "availability_type", v)
                              }
                            >
                              <SelectTrigger id={`p-avail-${idx}`}>
                                <SelectValue placeholder="Select availability" />
                              </SelectTrigger>
                              <SelectContent>
                                {AVAILABILITY_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor={`p-shift-${idx}`}>
                              Shift Type{" "}
                              <span className="text-destructive">*</span>
                            </Label>
                            <Select
                              value={position.shift_type}
                              onValueChange={(v) =>
                                updatePosition(idx, "shift_type", v)
                              }
                            >
                              <SelectTrigger id={`p-shift-${idx}`}>
                                <SelectValue placeholder="Select shift" />
                              </SelectTrigger>
                              <SelectContent>
                                {SHIFT_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor={`p-notes-${idx}`}>
                              Notes{" "}
                              <span className="text-destructive">*</span>{" "}
                              <span className="text-muted-foreground text-xs">
                                (max 1000)
                              </span>
                            </Label>
                            <Textarea
                              id={`p-notes-${idx}`}
                              value={position.notes}
                              onChange={(e) =>
                                updatePosition(idx, "notes", e.target.value)
                              }
                              placeholder="Position requirements or additional details..."
                              rows={2}
                              maxLength={1000}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* â”€â”€ Final Notes â”€â”€ */}
              <div className="space-y-2">
                <Label htmlFor="final_notes">
                  Final Notes{" "}
                  <span className="text-muted-foreground text-xs">(max 2000)</span>
                </Label>
                <Textarea
                  id="final_notes"
                  value={finalNotes}
                  onChange={(e) => setFinalNotes(e.target.value)}
                  placeholder="Any additional notes for this request..."
                  rows={3}
                  maxLength={2000}
                />
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
              {isSubmitting ? "Submitting..." : "Create Request"}
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
