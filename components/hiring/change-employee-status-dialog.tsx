"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { employeeService } from "@/lib/api/services/employee.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";

type EmployeeStatus = "hired" | "resigned" | "terminated" | "rehired" | "OJE";

const STATUS_OPTIONS: { value: EmployeeStatus; label: string }[] = [
  { value: "hired", label: "Hired" },
  { value: "resigned", label: "Resigned" },
  { value: "terminated", label: "Terminated" },
  { value: "rehired", label: "Rehired" },
  { value: "OJE", label: "OJE" },
];

interface ChangeEmployeeStatusDialogProps {
  employeeId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ChangeEmployeeStatusDialog({
  employeeId,
  open,
  onOpenChange,
  onSuccess,
}: ChangeEmployeeStatusDialogProps) {
  const { selectedStore } = useSelectedStoreStore();
  const [status, setStatus] = useState<EmployeeStatus | "">("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleClose(nextOpen: boolean) {
    if (isSubmitting) return;
    if (!nextOpen) {
      setStatus("");
      setEffectiveDate("");
      setNotes("");
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!status || !selectedStore?.storeId || employeeId === null) return;

    setIsSubmitting(true);
    try {
      await employeeService.updateEmployeeStatus(
        selectedStore.storeId,
        employeeId,
        {
          status,
          ...(effectiveDate ? { effective_date: effectiveDate } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      );
      toast.success("Employee status updated successfully.");
      handleClose(false);
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update employee status.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Employee Status</DialogTitle>
          <DialogDescription>
            Update the employment status for employee #{employeeId}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-status">
              Status <span className="text-destructive">*</span>
            </Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as EmployeeStatus)}
              required
            >
              <SelectTrigger id="emp-status">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Effective Date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-effective-date">Effective Date</Label>
            <Input
              id="emp-effective-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-notes">Notes</Label>
            <Textarea
              id="emp-notes"
              placeholder="Optional notes about this status change..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!status || isSubmitting}>
              {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
