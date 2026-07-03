"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useUnits } from "@/lib/hooks/use-inventory-units";
import type { Unit } from "@/types/inventory.types";

/**
 * Create/edit dialog for a Unit. When `unit` is provided it edits, otherwise creates.
 * Errors are shown inline (so the user keeps their input) instead of as a toast.
 */
export function UnitFormDialog({
  open,
  onOpenChange,
  unit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: Unit | null;
}) {
  const { createUnit, updateUnit, isSaving, saveError, clearErrors } = useUnits();
  const [name, setName] = useState("");

  const isEdit = Boolean(unit);

  // Reset the field whenever the dialog opens for a different unit.
  useEffect(() => {
    if (open) {
      setName(unit?.name ?? "");
      clearErrors();
    }
  }, [open, unit, clearErrors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (isEdit && unit) {
        await updateUnit(unit.id, { name: name.trim() });
        toast.success("Unit updated.");
      } else {
        await createUnit({ name: name.trim() });
        toast.success("Unit created.");
      }
      onOpenChange(false);
    } catch {
      // Inline saveError below handles display; nothing else to do.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit unit" : "Create unit"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Rename this measurement unit."
              : "Add a measurement unit (e.g. Box, Piece, Carton)."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="unit-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="unit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Box"
              maxLength={100}
              required
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create unit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
