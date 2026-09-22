"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { parseApiError } from "@/lib/api/utils/error";
import { shirtMilestoneService } from "@/lib/api/services/shirt-milestone.service";
import {
  SHIRT_ACTIONS_BY_STATUS,
  formatPlainDate,
  milestoneMonthLabel,
  shirtEmployeeName,
  toPlainDate,
  todayPlainDate,
} from "@/lib/shirts/shirt-utils";
import type { ShirtAction } from "@/lib/shirts/shirt-utils";
import type { ShirtMilestone } from "@/types/shirt-milestone.types";

export type ShirtActionMode = "order" | "reschedule" | "deliver" | "cancel";

const MODE_TO_ACTION: Record<ShirtActionMode, ShirtAction> = {
  order: "order",
  reschedule: "reschedule",
  deliver: "deliver",
  cancel: "cancel",
};

const COPY: Record<
  ShirtActionMode,
  { title: string; description: string; submit: string }
> = {
  order: {
    title: "Order this shirt",
    description: "Set the date the shirt is expected to arrive.",
    submit: "Mark Ordered",
  },
  reschedule: {
    title: "Change the delivery date",
    description: "The shirt stays ordered — only the expected date changes.",
    submit: "Save Date",
  },
  deliver: {
    title: "Mark as delivered",
    description: "Confirm the shirt was handed to the employee.",
    submit: "Mark Delivered",
  },
  cancel: {
    title: "Cancel this milestone",
    description:
      "Cancelling is permanent for this month — the nightly job will not re-create it.",
    submit: "Cancel Milestone",
  },
};

export interface ShirtActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ShirtActionMode;
  milestone: ShirtMilestone | null;
  onSuccess: (updated: ShirtMilestone) => void;
  /** Called when the action was refused because the row was stale. */
  onStale?: () => void;
}

/**
 * Order / reschedule / deliver / cancel. One component, because all four are
 * "one field and a submit".
 *
 * Out-of-order transitions throw upstream and surface as a raw 500 rather than
 * a 422, so this re-asserts the transition against SHIRT_ACTIONS_BY_STATUS
 * before issuing anything — a row that went stale while the queue sat open
 * gets an explanation and a refresh instead of an error nobody can read.
 */
export function ShirtActionDialog({
  open,
  onOpenChange,
  mode,
  milestone,
  onSuccess,
  onStale,
}: ShirtActionDialogProps) {
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNotes("");
    setReason("");
    setDeliveryDate(
      mode === "reschedule" ? (toPlainDate(milestone?.delivery_date) ?? "") : "",
    );
  }, [open, mode, milestone]);

  const allowed =
    milestone !== null &&
    SHIRT_ACTIONS_BY_STATUS[milestone.status].includes(MODE_TO_ACTION[mode]);

  const copy = COPY[mode];

  async function handleSubmit() {
    if (!milestone || !allowed) return;

    if ((mode === "order" || mode === "reschedule") && !deliveryDate) {
      setError({ message: "Pick a delivery date.", details: [] });
      return;
    }
    if (mode === "cancel" && !reason.trim()) {
      setError({ message: "Give a reason for cancelling.", details: [] });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let updated: ShirtMilestone;
      switch (mode) {
        case "order":
          updated = await shirtMilestoneService.order(milestone.id, {
            delivery_date: deliveryDate,
          });
          toast.success("Shirt marked as ordered.");
          break;
        case "reschedule":
          updated = await shirtMilestoneService.updateDeliveryDate(milestone.id, {
            delivery_date: deliveryDate,
          });
          toast.success("Delivery date updated.");
          break;
        case "deliver":
          updated = await shirtMilestoneService.deliver(milestone.id, {
            ...(notes.trim() ? { delivery_notes: notes.trim() } : {}),
          });
          toast.success("Shirt marked as delivered.");
          break;
        case "cancel":
          updated = await shirtMilestoneService.cancel(milestone.id, {
            cancellation_reason: reason.trim(),
          });
          toast.success("Milestone cancelled.");
          break;
      }

      onSuccess(updated);
      onOpenChange(false);
    } catch (err) {
      // A bare 500 here means the milestone moved on underneath us — the API
      // has no custom exception rendering for an out-of-order transition.
      // Don't leak that; say what actually happened and refresh the list.
      if (axios.isAxiosError(err) && err.response?.status === 500) {
        setError({
          message:
            "This milestone is no longer in a state that allows that. Refresh and try again.",
          details: [],
        });
        onStale?.();
      } else {
        setError(parseApiError(err, "Could not complete that action."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {milestone
              ? `${shirtEmployeeName(milestone.employee)} — ${milestoneMonthLabel(milestone.milestone_month)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {!allowed ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>This milestone has already moved on</AlertTitle>
            <AlertDescription>
              Refresh the queue to see its current state.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{copy.description}</p>

            {(mode === "order" || mode === "reschedule") && (
              <div className="flex flex-col gap-1.5">
                <Label>
                  Delivery date <span className="text-destructive">*</span>
                </Label>
                <DatePicker value={deliveryDate} onChange={setDeliveryDate} />
                {mode === "reschedule" && milestone?.delivery_date && (
                  <p className="text-xs text-muted-foreground">
                    Currently {formatPlainDate(milestone.delivery_date)}.
                  </p>
                )}
                {deliveryDate && deliveryDate < todayPlainDate() && (
                  <p className="text-xs text-muted-foreground">
                    That date is in the past.
                  </p>
                )}
              </div>
            )}

            {mode === "deliver" && (
              <div className="flex flex-col gap-1.5">
                <Label>Delivery notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
                  maxLength={2000}
                  rows={3}
                  placeholder="Optional."
                />
              </div>
            )}

            {mode === "cancel" && (
              <div className="flex flex-col gap-1.5">
                <Label>
                  Reason <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 1000))}
                  maxLength={1000}
                  rows={3}
                  placeholder="Why is this milestone being cancelled?"
                />
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{error.message}</AlertTitle>
                {error.details.length > 0 && (
                  <AlertDescription>
                    <ul className="list-disc ps-4">
                      {error.details.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                )}
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Close
          </Button>
          {allowed && (
            <Button
              variant={mode === "cancel" ? "destructive" : "default"}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {copy.submit}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
