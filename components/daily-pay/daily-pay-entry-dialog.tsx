"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import { dailyPayService, DailyPayError } from "@/lib/api/services/daily-pay.service";
import {
  emptyEntryFormState,
  emptyPayment,
  entryToFormState,
  formStateToInput,
  mergePaymentIntoFirstWithSamePayee,
  patchLine,
  patchPayment,
  siblingIssueIds,
  toNum,
  validateFormState,
  type EntryFormState,
  type LineForm,
  type PaymentForm,
} from "@/lib/daily-pay/entry-form-state";
import {
  EMPTY_FORM_ERRORS,
  clearFieldError,
  errorCount,
  firstErroredPaymentIndex,
  lineKey,
  parseValidationErrors,
  paymentKey,
  type DailyPayFormErrors,
} from "@/lib/daily-pay/field-errors";
import { TicketIssuePickerDialog } from "./ticket-issue-picker-dialog";
import { DailyPayPaymentCard } from "./daily-pay-payment-card";
import type { DailyPayEntry } from "@/types/daily-pay.types";
import type { CatalogTechnician } from "@/types/maintenance-tickets.types";
import type { DailyPayStoreOption } from "@/lib/hooks/use-daily-pay";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Create / edit a daily pay entry                                          */
/*                                                                            */
/*  This file owns dialog chrome, form state, and submit. Every rule with     */
/*  money consequences lives in lib/daily-pay/entry-form-state.ts, and the    */
/*  fields themselves are in the payment-card / line-fieldset components.     */
/* ────────────────────────────────────────────────────────────────────────── */

/** Which scope receives pasted files. Focus bubbles, so the innermost wins. */
interface PasteTarget {
  paymentIndex: number;
  /** Null ⇒ the payment itself rather than one of its lines. */
  lineIndex: number | null;
}

interface DailyPayEntryDialogProps {
  open: boolean;
  /** null → create mode; number → edit mode (prefills from detail). */
  entryId: number | null;
  stores: DailyPayStoreOption[];
  technicians: CatalogTechnician[];
  /**
   * Create mode only: open already filled in from the pay basket.
   *
   * Nothing is saved by this -- the form is populated and the coordinator
   * reviews it, the same discipline as everywhere else here. Ignored in edit
   * mode, where the server's own record is the only sane starting point.
   */
  initialState?: EntryFormState | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function DailyPayEntryDialog({
  open,
  entryId,
  stores,
  technicians,
  initialState,
  onClose,
  onSuccess,
}: DailyPayEntryDialogProps) {
  const isEdit = entryId != null;

  const [state, setState] = useState<EntryFormState>(emptyEntryFormState);
  const [errors, setErrors] = useState<DailyPayFormErrors>(EMPTY_FORM_ERRORS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [prefillError, setPrefillError] = useState<string | null>(null);
  /** Set when a save lost a race — the dialog stays open with edits intact. */
  const [conflict, setConflict] = useState<{ message: string } | null>(null);
  const [loadedEntry, setLoadedEntry] = useState<DailyPayEntry | null>(null);

  const [picker, setPicker] = useState<{ paymentIndex: number; lineIndex: number } | null>(
    null
  );
  /** Pending payee change that would invalidate already-linked issues. */
  const [payeeChange, setPayeeChange] = useState<{
    paymentIndex: number;
    technicianId: string;
    issueCount: number;
  } | null>(null);
  const [reloadConfirm, setReloadConfirm] = useState(false);

  const pasteTargetRef = useRef<PasteTarget>({ paymentIndex: 0, lineIndex: null });
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  /* ── Paste-to-attach ──────────────────────────────────────────────────── */

  // Suspended while any nested dialog is open, or a paste meant for a confirm
  // dialog would silently attach a file to a line behind it.
  const pasteSuspended =
    isSubmitting || picker !== null || payeeChange !== null || reloadConfirm;

  useEffect(() => {
    if (!open || pasteSuspended) return;

    function handlePaste(e: ClipboardEvent) {
      const pastedFiles = Array.from(e.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (pastedFiles.length === 0) return;
      e.preventDefault();

      const { paymentIndex, lineIndex } = pasteTargetRef.current;
      setState((prev) => {
        const payment = prev.payments[paymentIndex];
        if (!payment) return prev;
        if (lineIndex == null) {
          return {
            ...prev,
            payments: patchPayment(prev.payments, paymentIndex, {
              files: [...payment.files, ...pastedFiles],
            }),
          };
        }
        const line = payment.lines[lineIndex];
        if (!line) return prev;
        return {
          ...prev,
          payments: patchLine(prev.payments, paymentIndex, lineIndex, {
            files: [...line.files, ...pastedFiles],
          }),
        };
      });
    }

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [open, pasteSuspended]);

  /* ── Reset / prefill ──────────────────────────────────────────────────── */

  const loadEntry = useCallback(
    (id: number, signal?: AbortSignal) => {
      setIsPrefilling(true);
      setPrefillError(null);
      setErrors(EMPTY_FORM_ERRORS);
      setConflict(null);

      return dailyPayService
        .getEntry(id, signal)
        .then((entry) => {
          if (signal?.aborted) return;
          setLoadedEntry(entry);
          // expectedUpdatedAt comes from THIS read, never from a list row —
          // a list row can be minutes stale and would cause spurious 409s.
          setState(entryToFormState(entry));
        })
        .catch((err) => {
          if (signal?.aborted) return;
          if (err instanceof DailyPayError && err.code === "CANCELLED") return;
          setPrefillError(
            err instanceof DailyPayError ? err.message : "Failed to load entry."
          );
        })
        .finally(() => {
          if (!signal?.aborted) setIsPrefilling(false);
        });
    },
    []
  );

  useEffect(() => {
    if (!open) return;

    if (!isEdit) {
      // A seeded state wins on create. It carries the payees, the store lines
      // and the linked issues from the basket -- and deliberately no hours,
      // because any value sent marks the line overridden upstream and stops the
      // gather filling it from the attendance already logged.
      setState(initialState ?? emptyEntryFormState());
      setErrors(EMPTY_FORM_ERRORS);
      setPrefillError(null);
      setConflict(null);
      setLoadedEntry(null);
      return;
    }

    const ctrl = new AbortController();
    void loadEntry(entryId as number, ctrl.signal);
    return () => ctrl.abort();
  }, [open, entryId, isEdit, loadEntry, initialState]);

  /* ── Setters ──────────────────────────────────────────────────────────── */

  function patchState(patch: Partial<EntryFormState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  function updatePayment(index: number, patch: Partial<PaymentForm>) {
    setState((prev) => ({ ...prev, payments: patchPayment(prev.payments, index, patch) }));
    // Clear the errors on whatever just changed, so red borders do not linger.
    setErrors((prev) =>
      Object.keys(patch).reduce(
        (acc, key) => clearFieldError(acc, paymentKey(index, camelToSnake(key))),
        prev
      )
    );
  }

  function updateLine(paymentIndex: number, lineIndex: number, patch: Partial<LineForm>) {
    setState((prev) => ({
      ...prev,
      payments: patchLine(prev.payments, paymentIndex, lineIndex, patch),
    }));
    setErrors((prev) =>
      Object.keys(patch).reduce(
        (acc, key) => clearFieldError(acc, lineKey(paymentIndex, lineIndex, camelToSnake(key))),
        prev
      )
    );
  }

  function addPayment() {
    patchState({ payments: [...state.payments, emptyPayment()] });
  }

  function removePayment(index: number) {
    if (state.payments.length === 1) return;
    patchState({ payments: state.payments.filter((_, i) => i !== index) });
  }

  /**
   * A payee change invalidates every issue already linked under that payment,
   * because the backend requires the payee to be assigned to each one. Confirm
   * before discarding them rather than letting the save 422.
   */
  function requestPayeeChange(paymentIndex: number, technicianId: string) {
    const payment = state.payments[paymentIndex];
    if (!payment) return;
    const issueCount = payment.lines.reduce((n, l) => n + l.ticketIssueIds.length, 0);
    if (issueCount > 0 && payment.technicianId && payment.technicianId !== technicianId) {
      setPayeeChange({ paymentIndex, technicianId, issueCount });
      return;
    }
    updatePayment(paymentIndex, { technicianId });
  }

  function applyPayeeChange() {
    if (!payeeChange) return;
    const { paymentIndex, technicianId } = payeeChange;
    setState((prev) => ({
      ...prev,
      payments: patchPayment(prev.payments, paymentIndex, {
        technicianId,
        lines: (prev.payments[paymentIndex]?.lines ?? []).map((l) => ({
          ...l,
          ticketIssueIds: [],
        })),
      }),
    }));
    setPayeeChange(null);
  }

  /* ── Submit ───────────────────────────────────────────────────────────── */

  function scrollToFirstError(next: DailyPayFormErrors) {
    const index = firstErroredPaymentIndex(next);
    if (index == null) return;
    // Without this, the red border sits below the fold of a scrolling dialog.
    cardRefs.current
      .get(index)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function handleSubmit() {
    const validation = validateFormState(state);
    if (errorCount(validation) > 0) {
      setErrors(validation);
      toast.error(summaryMessage(validation));
      requestAnimationFrame(() => scrollToFirstError(validation));
      return;
    }

    setErrors(EMPTY_FORM_ERRORS);
    setConflict(null);
    setIsSubmitting(true);
    try {
      const payload = formStateToInput(state, { includeExpectedUpdatedAt: isEdit });
      if (isEdit) {
        await dailyPayService.editEntry(entryId as number, payload);
        toast.success("Daily pay entry updated.");
      } else {
        await dailyPayService.createEntry(payload);
        toast.success("Daily pay entry created.");
      }
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof DailyPayError && err.code === "CANCELLED") return;

      if (err instanceof DailyPayError && err.code === "CONFLICT") {
        setConflict({ message: err.message });
        // Re-arm from the server's own timestamp when it sent one, so
        // "Save anyway" becomes one deliberate click rather than a loop.
        if (err.serverUpdatedAt) {
          patchState({ expectedUpdatedAt: err.serverUpdatedAt });
        }
        // The list behind the dialog is now stale either way.
        onSuccess();
        return;
      }

      if (err instanceof DailyPayError && err.validationErrors) {
        const parsed = parseValidationErrors(err.validationErrors);
        setErrors(parsed);
        toast.error(summaryMessage(parsed) || err.message);
        requestAnimationFrame(() => scrollToFirstError(parsed));
        return;
      }

      toast.error(err instanceof DailyPayError ? err.message : "Failed to save entry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  const pickerContext = useMemo(() => {
    if (!picker) return null;
    const payment = state.payments[picker.paymentIndex];
    const line = payment?.lines[picker.lineIndex];
    if (!payment || !line) return null;
    const technicianId = toNum(payment.technicianId);
    if (technicianId == null) return null;
    return {
      technicianId,
      technicianName: technicians.find((t) => t.id === technicianId)?.name ?? "",
      // Null for an `other_store` line: it has no store number, so the picker
      // searches unscoped rather than showing nothing.
      storeNumber:
        line.locationKind === "store"
          ? stores.find((s) => String(s.id) === line.storeId)?.storeNumber ?? null
          : null,
      selectedIssueIds: line.ticketIssueIds,
      disabledIssueIds: siblingIssueIds(payment, picker.lineIndex),
    };
  }, [picker, state.payments, stores, technicians]);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && !isSubmitting && onClose()}>
        <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? `Edit Daily Pay Entry #${entryId}` : "New Daily Pay Entry"}
            </DialogTitle>
            <DialogDescription>
              One payment per payee; one line per store they worked.
              {isEdit &&
                " Saving replaces the full entry; the previous state is kept as a revision."}
            </DialogDescription>
          </DialogHeader>

          {isPrefilling ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              Loading entry…
            </div>
          ) : prefillError ? (
            <div className="py-8 text-center text-sm text-destructive">{prefillError}</div>
          ) : (
            <div className="space-y-4">
              {/* Lost-race banner. Deliberately does NOT close the dialog or
                  discard state — the user's edits are still in the form. */}
              {conflict && (
                <Alert className="border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/15">
                  <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-amber-800 dark:text-amber-300">
                    Someone else changed this entry
                  </AlertTitle>
                  <AlertDescription className="space-y-2 text-amber-700 dark:text-amber-400/90">
                    <p>
                      {conflict.message} Your changes are still here. Reload to see their
                      version, or save again to apply yours over it.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => setReloadConfirm(true)}
                      disabled={isSubmitting}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reload entry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Date */}
              <div className="space-y-1 sm:max-w-xs">
                <Label className="text-sm">
                  Workday date <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  value={state.date}
                  onChange={(date) => {
                    patchState({ date });
                    setErrors((prev) => clearFieldError(prev, "date"));
                  }}
                  disabled={isSubmitting}
                />
                {errors.fields.date && (
                  <p className="text-[11px] text-destructive">{errors.fields.date}</p>
                )}
              </div>

              <Separator />

              {/* Payments */}
              <div className="space-y-3">
                {state.payments.map((payment, i) => (
                  <DailyPayPaymentCard
                    key={i}
                    payment={payment}
                    index={i}
                    allPayments={state.payments}
                    stores={stores}
                    technicians={technicians}
                    errors={errors}
                    disabled={isSubmitting}
                    canRemove={state.payments.length > 1}
                    warnings={loadedEntry?.payments?.[i]?.aggregationWarnings ?? null}
                    onPatch={(patch) => updatePayment(i, patch)}
                    onPatchLine={(lineIndex, patch) => updateLine(i, lineIndex, patch)}
                    onRemove={() => removePayment(i)}
                    onRequestPayeeChange={(technicianId) =>
                      requestPayeeChange(i, technicianId)
                    }
                    onMergeIntoExisting={() =>
                      patchState({
                        payments: mergePaymentIntoFirstWithSamePayee(state.payments, i),
                      })
                    }
                    onOpenIssuePicker={(lineIndex) =>
                      setPicker({ paymentIndex: i, lineIndex })
                    }
                    onFocusPayment={() => {
                      pasteTargetRef.current = { paymentIndex: i, lineIndex: null };
                    }}
                    onFocusLine={(lineIndex) => {
                      pasteTargetRef.current = { paymentIndex: i, lineIndex };
                    }}
                    cardRef={(el) => {
                      if (el) cardRefs.current.set(i, el);
                      else cardRefs.current.delete(i);
                    }}
                  />
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={addPayment}
                  disabled={isSubmitting}
                >
                  <Plus className="h-4 w-4" />
                  Add payment
                </Button>
              </div>

              {/* Anything the server said that did not match a field. */}
              {errors.form.length > 0 && (
                <div className="space-y-1">
                  {errors.form.map((message, i) => (
                    <p key={i} className="text-sm text-destructive">
                      {message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isPrefilling || !!prefillError}
            >
              {isSubmitting && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue picker */}
      {picker && pickerContext && (
        <TicketIssuePickerDialog
          open
          storeNumber={pickerContext.storeNumber}
          technicianId={pickerContext.technicianId}
          technicianName={pickerContext.technicianName}
          selectedIssueIds={pickerContext.selectedIssueIds}
          disabledIssueIds={pickerContext.disabledIssueIds}
          onClose={() => setPicker(null)}
          onConfirm={(ids) => {
            updateLine(picker.paymentIndex, picker.lineIndex, { ticketIssueIds: ids });
            setPicker(null);
          }}
        />
      )}

      {/* Payee change would invalidate linked issues */}
      <AlertDialog
        open={payeeChange !== null}
        onOpenChange={(o) => !o && setPayeeChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change the payee?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears the {payeeChange?.issueCount} linked{" "}
              {payeeChange?.issueCount === 1 ? "issue" : "issues"} on this payment, because
              an issue must be assigned to whoever is being paid for it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep the current payee</AlertDialogCancel>
            <AlertDialogAction onClick={applyPayeeChange}>
              Change and clear issues
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reloading discards the user's edits, so confirm first */}
      <AlertDialog open={reloadConfirm} onOpenChange={setReloadConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Reloading replaces the form with the saved version. Anything you have typed
              since opening it will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setReloadConfirm(false);
                if (entryId != null) void loadEntry(entryId);
              }}
            >
              Reload and discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** Form state keys are camelCase; error keys use the server's snake_case. */
function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function summaryMessage(errors: DailyPayFormErrors): string {
  const count = errorCount(errors);
  if (count === 0) return "";
  return count === 1 ? "1 field needs attention." : `${count} fields need attention.`;
}
