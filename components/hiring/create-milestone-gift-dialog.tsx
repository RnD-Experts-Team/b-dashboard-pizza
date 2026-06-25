"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  Loader2,
  ChevronsUpDown,
  Check,
  Gift,
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
import { milestoneGiftService } from "@/lib/api/services/milestone-gift.service";
import { employeeService } from "@/lib/api/services/employee.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { parseApiError, type ParsedApiError } from "@/lib/api/utils/error";
import type { Milestone } from "@/types/milestone-gift.types";
import type { EmployeeV1Record } from "@/types/employee.types";

interface CreateMilestoneGiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const MILESTONES: { value: Milestone; label: string }[] = [
  { value: "30_days", label: "30 Days" },
  { value: "90_days", label: "90 Days" },
  { value: "6_months", label: "6 Months" },
  { value: "1_year", label: "1 Year" },
  { value: "2_years", label: "2 Years" },
  { value: "other", label: "Other" },
];

export function CreateMilestoneGiftDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateMilestoneGiftDialogProps) {
  const { selectedStore } = useSelectedStoreStore();

  // Employees
  const [employees, setEmployees] = useState<EmployeeV1Record[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Employee search combobox
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);

  // Form fields
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [milestone, setMilestone] = useState<Milestone | "">("");
  const [milestoneOther, setMilestoneOther] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);

  // Reset "other" detail when milestone changes away from "other"
  useEffect(() => {
    if (milestone !== "other") setMilestoneOther("");
  }, [milestone]);

  // Fetch employees when dialog opens
  useEffect(() => {
    if (!open || !selectedStore?.storeId) return;
    let cancelled = false;
    setIsLoadingData(true);
    setLoadError(null);

    employeeService
      .getEmployeesV1(selectedStore.storeId, { per_page: 99 })
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
  }, [open, selectedStore?.storeId]);

  const isDirty =
    selectedEmployeeId !== "" || milestone !== "" || milestoneOther !== "";

  function resetForm() {
    setSelectedEmployeeId("");
    setEmployeeSearch("");
    setEmployeeDropdownOpen(false);
    setMilestone("");
    setMilestoneOther("");
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

  const isFormValid =
    selectedEmployeeId !== "" &&
    milestone !== "" &&
    (milestone !== "other" || milestoneOther.trim() !== "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;

    if (!selectedStore?.storeId) {
      setError({
        message: "No store selected. Please select a store from the sidebar.",
        details: [],
      });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await milestoneGiftService.createMilestoneGiftRequest(
        selectedStore.storeId,
        {
          employee_id: Number(selectedEmployeeId),
          milestone: milestone as Milestone,
          milestone_other:
            milestone === "other" ? milestoneOther.trim() : undefined,
        },
      );

      toast.success("Milestone gift request created successfully.");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "CanceledError") return;
      setError(parseApiError(err, "Failed to create milestone gift request."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Create Milestone Gift Request
            </DialogTitle>
            <DialogDescription>
              Start a milestone gift workflow for an employee at this store.
            </DialogDescription>
          </DialogHeader>

          {loadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {isLoadingData ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading employees…
            </div>
          ) : (
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
                      className="w-full justify-between font-normal h-9 px-3"
                    >
                      <span className="truncate text-sm">
                        {selectedEmployeeId
                          ? (() => {
                              const emp = employees.find(
                                (e) => String(e.id) === selectedEmployeeId,
                              );
                              return emp
                                ? `${emp.first_name} ${emp.last_name}`
                                : `Employee #${selectedEmployeeId}`;
                            })()
                          : "Select an employee"}
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
                    <div className="max-h-56 overflow-y-auto">
                      {(() => {
                        const filtered = employees.filter((emp) => {
                          if (!employeeSearch.trim()) return true;
                          const q = employeeSearch.toLowerCase();
                          const name =
                            `${emp.first_name} ${emp.last_name}`.toLowerCase();
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
                          const isSelected =
                            String(emp.id) === selectedEmployeeId;
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
              </div>

              {/* ── Milestone ── */}
              <div className="space-y-2">
                <Label>
                  Milestone <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={milestone}
                  onValueChange={(v) => setMilestone(v as Milestone)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a milestone" />
                  </SelectTrigger>
                  <SelectContent>
                    {MILESTONES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ── Milestone "Other" detail ── */}
              {milestone === "other" && (
                <div className="space-y-2">
                  <Label htmlFor="milestone-other">
                    Describe the Milestone{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="milestone-other"
                    value={milestoneOther}
                    onChange={(e) => setMilestoneOther(e.target.value)}
                    placeholder="e.g. Custom celebration"
                    maxLength={255}
                  />
                </div>
              )}

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
