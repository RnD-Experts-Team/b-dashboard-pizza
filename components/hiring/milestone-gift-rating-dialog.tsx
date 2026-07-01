"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, Check, ClipboardList, Loader2 } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { milestoneGiftService } from "@/lib/api/services/milestone-gift.service";
import { parseApiError, type ParsedApiError } from "@/lib/api/utils/error";
import type { MilestoneGiftQuestion } from "@/types/milestone-gift.types";

interface MilestoneGiftRatingDialogProps {
  requestId: number | null;
  storeId: string;
  employeeName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MilestoneGiftRatingDialog({
  requestId,
  storeId,
  employeeName,
  open,
  onOpenChange,
  onSuccess,
}: MilestoneGiftRatingDialogProps) {

  const [questions, setQuestions] = useState<MilestoneGiftQuestion[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // answers: question_id -> selected option ids
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [additionalComments, setAdditionalComments] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);

  const resetForm = useCallback(() => {
    setAnswers({});
    setAdditionalComments("");
    setError(null);
    setLoadError(null);
  }, []);

  // Fetch the store's active questions when the dialog opens
  useEffect(() => {
    if (!open || !storeId) return;
    let cancelled = false;
    setIsLoadingData(true);
    setLoadError(null);
    setAnswers({});
    setAdditionalComments("");

    milestoneGiftService
      .getStoreQuestions(storeId)
      .then((qs) => {
        if (cancelled) return;
        setQuestions([...qs].sort((a, b) => a.sort_order - b.sort_order));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof Error && err.name === "CanceledError") return;
        setLoadError(
          err instanceof Error ? err.message : "Failed to load questions.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, storeId]);

  function toggleOption(
    question: MilestoneGiftQuestion,
    optionId: number,
  ) {
    setAnswers((prev) => {
      const current = prev[question.id] ?? [];
      if (question.question_type === "single_select") {
        return { ...prev, [question.id]: [optionId] };
      }
      // multi_select — toggle
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [question.id]: next };
    });
  }

  // Every question must have at least one selected option
  const isFormValid =
    questions.length > 0 &&
    questions.every((q) => (answers[q.id]?.length ?? 0) > 0);

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || requestId === null) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await milestoneGiftService.submitRating(
        storeId,
        requestId,
        {
          answers: questions.map((q) => ({
            question_id: q.id,
            option_ids: answers[q.id] ?? [],
          })),
          additional_comments: additionalComments.trim() || null,
        },
      );

      toast.success("Rating submitted successfully.");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "CanceledError") return;
      setError(parseApiError(err, "Failed to submit rating."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleClose())}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Submit Rating
          </DialogTitle>
          <DialogDescription>
            Answer the questions about this employee to advance the request.
          </DialogDescription>
        </DialogHeader>

        {(employeeName || storeId) && (
          <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {employeeName && (
              <span className="font-medium truncate">{employeeName}</span>
            )}
            {employeeName && storeId && (
              <span className="text-muted-foreground shrink-0">·</span>
            )}
            {storeId && (
              <span className="font-mono text-xs text-muted-foreground shrink-0">
                {storeId}
              </span>
            )}
          </div>
        )}

        {loadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {isLoadingData ? (
          <div className="space-y-4 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : questions.length === 0 && !loadError ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            No rating questions are configured for this store.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
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

            {questions.map((q, idx) => {
              const selected = answers[q.id] ?? [];
              return (
                <div key={q.id} className="space-y-2">
                  <Label className="leading-snug">
                    {idx + 1}. {q.question_text}{" "}
                    <span className="text-destructive">*</span>
                    <span className="ms-1 text-xs font-normal text-muted-foreground">
                      ({q.question_type === "multi_select"
                        ? "select all that apply"
                        : "select one"}
                      )
                    </span>
                  </Label>
                  <div className="space-y-1.5">
                    {q.options.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">
                        No options available for this question.
                      </p>
                    )}
                    {[...q.options]
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((opt) => {
                        const isSelected = selected.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => toggleOption(q, opt.id)}
                            className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-start text-sm transition-colors hover:bg-accent ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-input"
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                                q.question_type === "single_select"
                                  ? "rounded-full"
                                  : "rounded-sm"
                              } ${
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-input"
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </span>
                            <span>{opt.option_text}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              );
            })}

            {/* Additional comments */}
            <div className="space-y-2">
              <Label htmlFor="mg-additional-comments">
                Additional Comments{" "}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Textarea
                id="mg-additional-comments"
                value={additionalComments}
                onChange={(e) => setAdditionalComments(e.target.value)}
                placeholder="Any extra notes about this employee…"
                rows={3}
                maxLength={2000}
              />
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
                    Submitting…
                  </>
                ) : (
                  "Submit Rating"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
