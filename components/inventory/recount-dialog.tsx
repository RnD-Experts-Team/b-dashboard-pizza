"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useEntriesStore } from "@/lib/store/inventory-entries.store";
import type { EntryItem } from "@/types/inventory.types";

/**
 * Recount dialog — edits one entry item's counts and requires a reason (5–1000 chars).
 * The change is logged to the backend's append-only history.
 */
export function RecountDialog({
  open,
  onOpenChange,
  entryItem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryItem: EntryItem | null;
}) {
  const { recountItem, isSaving, saveError, clearErrors } = useEntriesStore();

  const [count1, setCount1] = useState("");
  const [count2, setCount2] = useState("");
  const [count3, setCount3] = useState("");
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // Whether this item even has a third unit (controls the third field).
  const hasUnit3 = Boolean(entryItem?.item.unit_3);

  useEffect(() => {
    if (open && entryItem) {
      setCount1(entryItem.count_unit_1 ?? "0");
      setCount2(entryItem.count_unit_2 ?? "0");
      setCount3(entryItem.count_unit_3 ?? "0");
      setReason("");
      setLocalError(null);
      clearErrors();
    }
  }, [open, entryItem, clearErrors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryItem) return;

    // Mirror the API rules client-side.
    if (Number(count1) < 0 || Number(count2) < 0 || Number(count3) < 0) {
      setLocalError("Counts cannot be negative.");
      return;
    }
    if (reason.trim().length < 5 || reason.trim().length > 1000) {
      setLocalError("Reason must be between 5 and 1000 characters.");
      return;
    }
    setLocalError(null);

    try {
      await recountItem(entryItem.id, {
        count_unit_1: Number(count1),
        count_unit_2: Number(count2),
        count_unit_3: hasUnit3 ? Number(count3) : undefined,
        reason: reason.trim(),
      });
      toast.success("Recount saved.");
      onOpenChange(false);
    } catch {
      // saveError rendered inline below.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recount item</DialogTitle>
          <DialogDescription>
            {entryItem?.item.name_en} — update the counted quantities.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {(localError || saveError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{localError || saveError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="c1">
                {entryItem?.item.unit_1?.name ?? "Unit 1"}
              </Label>
              <Input
                id="c1"
                type="number"
                min="0"
                step="any"
                value={count1}
                onChange={(e) => setCount1(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c2">
                {entryItem?.item.unit_2?.name ?? "Unit 2"}
              </Label>
              <Input
                id="c2"
                type="number"
                min="0"
                step="any"
                value={count2}
                onChange={(e) => setCount2(e.target.value)}
                required
              />
            </div>
            {hasUnit3 && (
              <div className="space-y-2">
                <Label htmlFor="c3">{entryItem?.item.unit_3?.name}</Label>
                <Input
                  id="c3"
                  type="number"
                  min="0"
                  step="any"
                  value={count3}
                  onChange={(e) => setCount3(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for edit (min 5 chars){" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Recount after review"
              rows={3}
              minLength={5}
              maxLength={1000}
              required
            />
            <p className="text-xs text-muted-foreground">
              {reason.trim().length}/1000
            </p>
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
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              Save recount
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
