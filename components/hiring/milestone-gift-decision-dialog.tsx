"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Gift, Loader2 } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { milestoneGiftService } from "@/lib/api/services/milestone-gift.service";
import { parseApiError, type ParsedApiError } from "@/lib/api/utils/error";
import type { MilestoneGiftDecision } from "@/types/milestone-gift.types";

interface MilestoneGiftDecisionDialogProps {
  requestId: number | null;
  storeId: string;
  /** Existing decision (for upsert / pre-fill) */
  decision?: MilestoneGiftDecision | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MilestoneGiftDecisionDialog({
  requestId,
  storeId,
  decision,
  open,
  onOpenChange,
  onSuccess,
}: MilestoneGiftDecisionDialogProps) {

  const [isCancelled, setIsCancelled] = useState(false);

  // Approve fields
  const [giftDescription, setGiftDescription] = useState("");
  const [giftCost, setGiftCost] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [sentToStore, setSentToStore] = useState(false);

  // Cancel field
  const [cancellationReason, setCancellationReason] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);

  // Pre-fill from an existing decision when the dialog opens
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (decision) {
      setIsCancelled(decision.is_cancelled);
      setGiftDescription(decision.gift_description ?? "");
      setGiftCost(decision.gift_cost != null ? String(decision.gift_cost) : "");
      setDeliveryDate((decision.delivery_date ?? "").slice(0, 10));
      setSentToStore(decision.sent_to_store ?? false);
      setCancellationReason(decision.cancellation_reason ?? "");
    } else {
      setIsCancelled(false);
      setGiftDescription("");
      setGiftCost("");
      setDeliveryDate("");
      setSentToStore(false);
      setCancellationReason("");
    }
  }, [open, decision]);

  const isFormValid = isCancelled
    ? cancellationReason.trim() !== ""
    : giftDescription.trim() !== "" &&
      giftCost.trim() !== "" &&
      !Number.isNaN(Number(giftCost)) &&
      deliveryDate.trim() !== "";

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || requestId === null) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await milestoneGiftService.submitGiftDecision(
        storeId,
        requestId,
        isCancelled
          ? {
              is_cancelled: true,
              cancellation_reason: cancellationReason.trim(),
            }
          : {
              is_cancelled: false,
              gift_description: giftDescription.trim(),
              gift_cost: Number(giftCost),
              delivery_date: deliveryDate,
              sent_to_store: sentToStore,
            },
      );

      toast.success("Gift decision saved.");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "CanceledError") return;
      setError(parseApiError(err, "Failed to save gift decision."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Gift Decision
          </DialogTitle>
          <DialogDescription>
            Approve and record the gift, or cancel this request.
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

          {/* Decision toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={!isCancelled ? "default" : "outline"}
              className="flex-1"
              onClick={() => setIsCancelled(false)}
            >
              Approve Gift
            </Button>
            <Button
              type="button"
              variant={isCancelled ? "destructive" : "outline"}
              className="flex-1"
              onClick={() => setIsCancelled(true)}
            >
              Cancel Request
            </Button>
          </div>

          {isCancelled ? (
            <div className="space-y-2">
              <Label htmlFor="mg-cancellation-reason">
                Cancellation Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="mg-cancellation-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Explain why the gift won't happen…"
                rows={3}
                maxLength={2000}
              />
            </div>
          ) : (
            <div className="rounded-md border p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mg-gift-description">
                  Gift Description <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="mg-gift-description"
                  value={giftDescription}
                  onChange={(e) => setGiftDescription(e.target.value)}
                  placeholder="e.g. Amazon Gift Card"
                  maxLength={255}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="mg-gift-cost">
                    Gift Cost <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="mg-gift-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={giftCost}
                    onChange={(e) => setGiftCost(e.target.value)}
                    placeholder="50.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mg-delivery-date">
                    Delivery Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="mg-delivery-date"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="mg-sent-to-store"
                  checked={sentToStore}
                  onCheckedChange={(c) => setSentToStore(c === true)}
                />
                <Label
                  htmlFor="mg-sent-to-store"
                  className="text-sm font-normal cursor-pointer"
                >
                  Send to store (instead of directly to the employee)
                </Label>
              </div>
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
              {isSubmitting ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Decision"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
