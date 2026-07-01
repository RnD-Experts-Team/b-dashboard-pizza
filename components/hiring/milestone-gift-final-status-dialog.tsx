"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Loader2, PackageCheck } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { milestoneGiftService } from "@/lib/api/services/milestone-gift.service";
import { parseApiError, type ParsedApiError } from "@/lib/api/utils/error";
import type {
  MilestoneGiftFinalStatus,
  MilestoneGiftFinalStatusRecord,
} from "@/types/milestone-gift.types";

interface MilestoneGiftFinalStatusDialogProps {
  requestId: number | null;
  storeId: string;
  /** Existing final status (for upsert / pre-fill) */
  finalStatus?: MilestoneGiftFinalStatusRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const FINAL_STATUSES: { value: MilestoneGiftFinalStatus; label: string }[] = [
  { value: "delivered_to_employee", label: "Delivered to Employee" },
  {
    value: "sent_to_store_awaiting_pickup",
    label: "Sent to Store — Awaiting Pickup",
  },
  {
    value: "not_delivered_no_longer_with_company",
    label: "Not Delivered — Employee Left",
  },
  {
    value: "not_delivered_other_reason",
    label: "Not Delivered — Other Reason",
  },
];

export function MilestoneGiftFinalStatusDialog({
  requestId,
  storeId,
  finalStatus,
  open,
  onOpenChange,
  onSuccess,
}: MilestoneGiftFinalStatusDialogProps) {

  const [status, setStatus] = useState<MilestoneGiftFinalStatus | "">("");
  const [statusOtherReason, setStatusOtherReason] = useState("");
  const [confirmationDate, setConfirmationDate] = useState("");
  const [close, setClose] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (finalStatus) {
      setStatus(finalStatus.status);
      setStatusOtherReason(finalStatus.status_other_reason ?? "");
      setConfirmationDate((finalStatus.confirmation_date ?? "").slice(0, 10));
      setClose(finalStatus.closed_at != null);
      setClosingNotes(finalStatus.closing_notes ?? "");
    } else {
      setStatus("");
      setStatusOtherReason("");
      setConfirmationDate("");
      setClose(false);
      setClosingNotes("");
    }
  }, [open, finalStatus]);

  const isFormValid =
    status !== "" &&
    confirmationDate.trim() !== "" &&
    (status !== "not_delivered_other_reason" ||
      statusOtherReason.trim() !== "");

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || requestId === null) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await milestoneGiftService.submitFinalStatus(
        storeId,
        requestId,
        {
          status: status as MilestoneGiftFinalStatus,
          confirmation_date: confirmationDate,
          ...(status === "not_delivered_other_reason"
            ? { status_other_reason: statusOtherReason.trim() }
            : {}),
          ...(close
            ? { close: true, closing_notes: closingNotes.trim() || undefined }
            : {}),
        },
      );

      toast.success(
        close ? "Final status saved and request closed." : "Final status saved.",
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "CanceledError") return;
      setError(parseApiError(err, "Failed to save final status."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            Final Status
          </DialogTitle>
          <DialogDescription>
            Record what happened with the gift and optionally close the request.
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

          {/* Status */}
          <div className="space-y-2">
            <Label>
              Status <span className="text-destructive">*</span>
            </Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as MilestoneGiftFinalStatus)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {FINAL_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Other reason */}
          {status === "not_delivered_other_reason" && (
            <div className="space-y-2">
              <Label htmlFor="mg-status-other">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="mg-status-other"
                value={statusOtherReason}
                onChange={(e) => setStatusOtherReason(e.target.value)}
                placeholder="Why wasn't it delivered?"
                rows={2}
                maxLength={500}
              />
            </div>
          )}

          {/* Confirmation date */}
          <div className="space-y-2">
            <Label htmlFor="mg-confirmation-date">
              Confirmation Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="mg-confirmation-date"
              type="date"
              value={confirmationDate}
              onChange={(e) => setConfirmationDate(e.target.value)}
            />
          </div>

          {/* Close ticket */}
          <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="mg-close"
                checked={close}
                onCheckedChange={(c) => setClose(c === true)}
              />
              <Label
                htmlFor="mg-close"
                className="text-sm font-normal cursor-pointer"
              >
                Close this request
              </Label>
            </div>
            {close && (
              <div className="space-y-2">
                <Label htmlFor="mg-closing-notes">
                  Closing Notes{" "}
                  <span className="text-muted-foreground text-xs">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="mg-closing-notes"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Any final notes…"
                  rows={2}
                  maxLength={2000}
                />
              </div>
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
              {isSubmitting ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Status"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
