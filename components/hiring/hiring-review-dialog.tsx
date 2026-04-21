"use client";

import { useState } from "react";
import { ClipboardCheck, AlertCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { hiringService } from "@/lib/api/services/hiring.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";

interface HiringReviewDialogProps {
  requestId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function HiringReviewDialog({
  requestId,
  open,
  onOpenChange,
  onSuccess,
}: HiringReviewDialogProps) {
  const { selectedStore } = useSelectedStoreStore();

  const [isCompleted, setIsCompleted] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setIsCompleted(false);
    setNotes("");
    setError(null);
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requestId === null || !selectedStore?.storeId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await hiringService.submitHiringReview(selectedStore.storeId, requestId, {
        is_completed: isCompleted,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      toast.success("Hiring review submitted.");
      handleClose();
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit hiring review.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Hiring Review #{requestId}
          </DialogTitle>
          <DialogDescription>
            Submit a hiring review for this request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="is_completed" className="cursor-pointer">
              Is Completed
            </Label>
            <Switch
              id="is_completed"
              checked={isCompleted}
              onCheckedChange={setIsCompleted}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="review_notes">Notes</Label>
            <Textarea
              id="review_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this review…"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isCompleted}>
              {isSubmitting ? "Submitting…" : "Submit Review"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
