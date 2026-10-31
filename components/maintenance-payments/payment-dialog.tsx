"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Paperclip, Plus, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useParts, useSuppliers, useTechnicians } from "@/lib/hooks/use-maintenance-catalog";
import { maintenancePaymentsService, usePayment, useTechnicianPurchases } from "@/lib/hooks/use-maintenance-payments";
import { useMaintenanceMutation } from "@/lib/hooks/use-maintenance-resource";
import { useUnpaidSessions } from "@/lib/hooks/use-maintenance-trips";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import {
  EMPTY_FORM_ERRORS,
  clearFieldError,
  errorCount,
  firstErrorKey,
  formErrorsFrom,
  lineErrorKey,
  type FormErrors,
} from "@/lib/maintenance-payments/field-errors";
import {
  PAYMENT_ROOT_FIELDS,
  addLine,
  draftFromPayment,
  draftToEditInput,
  draftToInput,
  previewTotal,
  removeLine,
  validateDraft,
  type PaymentDraft,
  type PaymentLineDraft,
  type PreviewContext,
} from "@/lib/maintenance-payments/form-state";
import { changePaidTo, draftFromPrefill, draftSignature, hydratePaidTo, type PaymentPrefill } from "@/lib/maintenance-payments/prefill";
import { formatMoney } from "@/lib/maintenance/money";
import { PAYMENT_METHODS, vocabOptions, vocabText } from "@/lib/maintenance/vocabulary";
import type { Part, Payment, PaymentMethod, Supplier, TechnicianPurchase } from "@/types/maintenance-system";
import { Field, fieldId } from "./field";
import { PaidToPicker, paidToChoiceFrom } from "./paid-to-picker";
import { PaymentLineCard, type LineLookups } from "./payment-line-card";
import type { SessionOption } from "./session-checklist";
import { useStorageLocations, useStoreOptions } from "./use-payment-lookups";

export type { PaymentPrefill };

export interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set to edit a saved payment. */
  paymentId?: number;
  prefill?: PaymentPrefill;
  onSaved?: (paymentId: number) => void;
}

/** Enough for the whole catalog in one picker. */
const CATALOG_PAGE = 200;
const NO_METHOD = "__none__";
const ERROR_SHAPE = { rootFields: [...PAYMENT_ROOT_FIELDS], itemArrays: ["lines"] } as const;
const ACCEPT_FILES = "image/*,application/pdf";

/**
 * Record a payment / Edit a payment (docs/MAINTENANCE-UI.md §5): one
 * scrolling form, no wizard. Paid to · date · how we paid · reference ·
 * invoice # · invoice file, then the lines (each a compact card whose Type
 * reveals only its fields), and a sticky running total with Save.
 *
 * Mounted only while open, so every open starts from the prefill (or the
 * saved payment) again.
 */
export function PaymentDialog(props: PaymentDialogProps) {
  if (!props.open) return null;
  return <PaymentDialogBody {...props} />;
}

function PaymentDialogBody({ onOpenChange, paymentId, prefill, onSaved }: PaymentDialogProps) {
  const t = useTranslations("maintenanceSystem");
  const editing = paymentId != null;
  const [today] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [prefillDraft] = useState(() => draftFromPrefill(today, prefill));

  /* ── The saved payment (edit) ─────────────────────────────────────── */

  const { payment, isLoading: paymentLoading, error: paymentError, refresh: reloadPayment } = usePayment(editing ? paymentId : null);
  const base = useMemo<PaymentDraft | null>(() => {
    if (!editing) return prefillDraft;
    return payment ? draftFromPayment(payment) : null;
  }, [editing, payment, prefillDraft]);

  /* ── Catalog ──────────────────────────────────────────────────────── */

  const techniciansRes = useTechnicians({ perPage: CATALOG_PAGE, withTrashed: editing });
  const suppliersRes = useSuppliers({ perPage: CATALOG_PAGE, withTrashed: editing });
  const partsRes = useParts();
  const [createdSuppliers, setCreatedSuppliers] = useState<Supplier[]>([]);
  const [createdParts, setCreatedParts] = useState<Part[]>([]);
  const suppliers = useMemo(
    () => [...suppliersRes.suppliers, ...createdSuppliers.filter((c) => !suppliersRes.suppliers.some((s) => s.id === c.id))],
    [suppliersRes.suppliers, createdSuppliers],
  );
  const parts = useMemo(
    () => [...partsRes.parts, ...createdParts.filter((c) => !partsRes.parts.some((p) => p.id === c.id))],
    [partsRes.parts, createdParts],
  );
  const { stores, storeNumberOf } = useStoreOptions();

  /* ── The draft ────────────────────────────────────────────────────── */

  const [state, setState] = useState<PaymentDraft | null>(null);
  const [errors, setErrors] = useState<FormErrors>(EMPTY_FORM_ERRORS);
  const [showMore, setShowMore] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  /** Remounts the file input after each pick so the same file can be picked again. */
  const [fileInputKey, setFileInputKey] = useState(0);

  const known = useCallback(
    (d: PaymentDraft) => hydratePaidTo(d, paidToChoiceFrom(d.paidTo, techniciansRes.technicians, suppliers)),
    [techniciansRes.technicians, suppliers],
  );
  const current = state ?? base;
  const draft = useMemo(() => (current ? known(current) : null), [current, known]);
  const baseline = useMemo(() => (base ? draftSignature(base) : ""), [base]);
  const dirty = Boolean(draft && state && draftSignature(state) !== baseline);

  const update = (fn: (d: PaymentDraft) => PaymentDraft) => setState((prev) => fn(known(prev ?? (base as PaymentDraft))));
  const clearError = (...keys: string[]) => setErrors((e) => keys.reduce((acc, k) => clearFieldError(acc, k), e));

  /* ── What the paid technician has not been paid for ──────────────── */

  const technicianId = draft?.paidTo?.type === "technician" ? draft.paidTo.id : null;
  const unpaid = useUnpaidSessions(technicianId);
  const purchasesRes = useTechnicianPurchases({ technicianId: technicianId ?? undefined, unpaid: true }, technicianId != null);
  const savedForSameTech = payment && payment.paidTo.type === "technician" && payment.paidTo.id === technicianId ? payment : null;

  const sessions = useMemo<SessionOption[]>(() => {
    const open = unpaid.sessions.map((s) => ({
      id: s.id,
      clockIn: s.clockIn,
      clockOut: s.clockOut,
      paidMinutes: s.durations.paid,
      stores: Array.from(new Set(s.ticketIssues.map((i) => i.storeNumber).filter((x): x is string => Boolean(x)))),
    }));
    const claimed = (savedForSameTech?.lines ?? [])
      .flatMap((l) => l.tripSessions)
      .filter((s) => !open.some((o) => o.id === s.id))
      .map((s) => ({ id: s.id, clockIn: s.clockIn, clockOut: s.clockOut, paidMinutes: s.paidMinutes }));
    return [...claimed, ...open].sort((a, b) => a.clockIn.localeCompare(b.clockIn));
  }, [unpaid.sessions, savedForSameTech]);

  const previewCtx = useMemo<PreviewContext>(
    () => ({ sessionPaidMinutes: Object.fromEntries(sessions.map((s) => [s.id, s.paidMinutes])) }),
    [sessions],
  );

  const purchases = useMemo<TechnicianPurchase[]>(() => {
    const open = purchasesRes.purchases.filter((p) => !p.mistaken);
    const claimed = (savedForSameTech?.lines ?? []).flatMap((l) => l.technicianPurchases).filter((p) => !open.some((o) => o.id === p.id));
    return [...claimed, ...open];
  }, [purchasesRes.purchases, savedForSameTech]);

  const issueLabels = useMemo(() => {
    const fromPayment = (payment?.lines ?? []).flatMap((l) => l.ticketIssues);
    const fromSessions = unpaid.sessions.flatMap((s) => s.ticketIssues);
    const fromPurchases = purchases.flatMap((p) => (p.ticketIssue ? [p.ticketIssue] : []));
    return Object.fromEntries(
      [...fromPayment, ...fromSessions, ...fromPurchases].map((i) => [i.id, `#${i.ticketId} · ${i.title}`]),
    ) as Record<number, string>;
  }, [payment, unpaid.sessions, purchases]);

  const needsLocations = Boolean(draft?.lines.some((l) => l.type === "parts" && l.destination === "storage"));
  const locationsRes = useStorageLocations(needsLocations);

  const lookups: LineLookups = {
    paidTo: draft?.paidTo ?? null,
    stores,
    storeNumberOf,
    sessions,
    sessionsLoading: unpaid.isLoading,
    previewCtx,
    purchases,
    parts,
    partsLoading: partsRes.isLoading,
    onPartCreated: (p) => setCreatedParts((xs) => [...xs, p]),
    suppliers,
    onSupplierCreated: (s) => setCreatedSuppliers((xs) => [...xs, s]),
    locations: locationsRes.locations,
    locationsLoading: locationsRes.isLoading,
    issueLabels,
  };

  /* ── Save ─────────────────────────────────────────────────────────── */

  const create = useMaintenanceMutation(maintenancePaymentsService.createPayment);
  const edit = useMaintenanceMutation(maintenancePaymentsService.editPayment);
  const saving = create.isPending || edit.isPending;

  const focusFirst = (errs: FormErrors) => {
    const key = firstErrorKey(errs, PAYMENT_ROOT_FIELDS);
    if (!key) return;
    const target = key === "supplier_id" ? "technician_id" : key;
    requestAnimationFrame(() => {
      const el = document.getElementById(fieldId(target));
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    });
  };

  const save = async () => {
    if (!draft) return;
    const serialsNeeded = (partId: number) => parts.find((p) => p.id === partId)?.trackSerials ?? false;
    const local = validateDraft(draft, serialsNeeded);
    if (errorCount(local)) {
      setErrors(local);
      focusFirst(local);
      return;
    }
    setErrors(EMPTY_FORM_ERRORS);
    try {
      const saved: Payment =
        editing && paymentId != null
          ? await edit.run(paymentId, draftToEditInput(draft))
          : await create.run(draftToInput(draft));
      toast.success(
        editing ? t("payments.savedEdit") : t("payments.savedNew", { total: formatMoney(saved.total), name: saved.paidTo.name }),
      );
      onSaved?.(saved.id);
      onOpenChange(false);
    } catch (err) {
      const conflict = err instanceof MaintenanceTicketsError && err.code === "CONFLICT";
      const parsed = conflict ? { fields: {}, form: [t("payments.conflict")] } : formErrorsFrom(err, ERROR_SHAPE);
      setErrors(parsed);
      focusFirst(parsed);
    }
  };

  /* ── Close guard ──────────────────────────────────────────────────── */

  const requestClose = (next: boolean) => {
    if (next) return;
    if (saving) return;
    if (dirty) setConfirmClose(true);
    else onOpenChange(false);
  };

  /* ── Render ───────────────────────────────────────────────────────── */

  const total = draft ? previewTotal(draft, previewCtx) : 0;
  const paidToError = errors.fields.technician_id ?? errors.fields.supplier_id;
  const sessionsOn = (uid: string) => (draft?.lines ?? []).filter((l) => l.uid !== uid).flatMap((l) => l.tripSessionIds);
  const purchasesOn = (uid: string) => (draft?.lines ?? []).filter((l) => l.uid !== uid).flatMap((l) => l.technicianPurchaseIds);

  const onLineChange = (index: number) => (next: PaymentLineDraft, touched?: string) => {
    update((d) => ({ ...d, lines: d.lines.map((l) => (l.uid === next.uid ? next : l)) }));
    if (touched) {
      const extra = touched === "storeId" ? ["otherStore", "storageLocationId"] : [];
      clearError(...[touched, ...extra].map((f) => lineErrorKey(index, f)));
    }
  };

  const methodOptions = vocabOptions(PAYMENT_METHODS);

  return (
    <>
      <Dialog open onOpenChange={requestClose}>
        <DialogContent
          className="flex max-h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
          onInteractOutside={(e) => {
            if (dirty || saving) e.preventDefault();
            if (dirty && !saving) setConfirmClose(true);
          }}
        >
          <DialogHeader className="border-b px-5 pt-5 pb-3 text-start">
            <DialogTitle className="font-heading font-semibold">
              {editing ? t("payments.editTitle", { id: paymentId }) : t("payments.recordPayment")}
            </DialogTitle>
            <DialogDescription>{editing ? t("payments.editDescription") : t("payments.dialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {editing && paymentError && !payment && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
                <AlertCircle className="size-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{paymentError.message || t("common.loadError")}</p>
                <Button variant="outline" size="sm" onClick={() => void reloadPayment()}>
                  {t("common.retry")}
                </Button>
              </div>
            )}
            {editing && paymentLoading && !payment && <DialogSkeleton />}
            {draft && (
              <form
                className="space-y-5"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                {errors.form.length > 0 && (
                  <div role="alert" className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div className="space-y-0.5">
                      {errors.form.map((m) => (
                        <p key={m}>{m}</p>
                      ))}
                    </div>
                  </div>
                )}
                {payment?.mistaken && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {t("payments.mistakenCannotEdit")}
                  </p>
                )}

                {/* 1. Paid to */}
                <Field htmlFor={fieldId("technician_id")} label={t("payments.paidTo")} required error={paidToError} help={t("payments.paidToHelp")}>
                  <PaidToPicker
                    id={fieldId("technician_id")}
                    technicians={techniciansRes.technicians}
                    suppliers={suppliers}
                    value={draft.paidTo}
                    fallbackName={payment?.paidTo.name}
                    loading={techniciansRes.isLoading || suppliersRes.isLoading}
                    invalid={Boolean(paidToError)}
                    onChange={(choice) => {
                      update((d) => changePaidTo(d, choice));
                      clearError("technician_id", "supplier_id");
                    }}
                    onSupplierCreated={(s) => setCreatedSuppliers((xs) => [...xs, s])}
                  />
                </Field>

                {/* 2. Date · how we paid · reference · invoice # · invoice file */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field htmlFor={fieldId("paid_at")} label={t("common.date")} required error={errors.fields.paid_at}>
                    <Input
                      id={fieldId("paid_at")}
                      type="date"
                      value={draft.paidAt}
                      max={today}
                      onChange={(e) => {
                        const paidAt = e.target.value;
                        update((d) => ({ ...d, paidAt }));
                        clearError("paid_at");
                      }}
                      className="h-9 tabular-nums [color-scheme:light] dark:[color-scheme:dark]"
                      aria-invalid={Boolean(errors.fields.paid_at) || undefined}
                    />
                  </Field>
                  <Field htmlFor={fieldId("method")} label={t("payments.howWePaid")} error={errors.fields.method}>
                    <Select
                      value={draft.method ?? NO_METHOD}
                      onValueChange={(v) => {
                        const method = v === NO_METHOD ? null : (v as PaymentMethod);
                        update((d) => ({ ...d, method }));
                        clearError("method");
                      }}
                    >
                      <SelectTrigger id={fieldId("method")} className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_METHOD}>{t("payments.methodNotSaid")}</SelectItem>
                        {methodOptions.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {vocabText(t, m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field htmlFor={fieldId("reference")} label={t("payments.reference")} error={errors.fields.reference} help={t("payments.referenceHelp")}>
                    <Input
                      id={fieldId("reference")}
                      value={draft.reference}
                      onChange={(e) => {
                        const reference = e.target.value;
                        update((d) => ({ ...d, reference }));
                        clearError("reference");
                      }}
                      className="h-9"
                    />
                  </Field>
                  <Field htmlFor={fieldId("invoice_number")} label={t("payments.invoiceNumber")} error={errors.fields.invoice_number}>
                    <Input
                      id={fieldId("invoice_number")}
                      value={draft.invoiceNumber}
                      onChange={(e) => {
                        const invoiceNumber = e.target.value;
                        update((d) => ({ ...d, invoiceNumber }));
                        clearError("invoice_number");
                      }}
                      className="h-9"
                    />
                  </Field>
                  <Field
                    className="sm:col-span-2"
                    htmlFor={fieldId("files")}
                    label={t("payments.invoiceFile")}
                    error={errors.fields.files}
                    help={
                      editing && payment?.attachments.length
                        ? t("payments.filesAlreadyAttached", { count: payment.attachments.length })
                        : t("payments.invoiceFileHelp")
                    }
                  >
                    <Input
                      key={fileInputKey}
                      id={fieldId("files")}
                      type="file"
                      multiple
                      accept={ACCEPT_FILES}
                      onChange={(e) => {
                        const picked = Array.from(e.target.files ?? []);
                        setFileInputKey((k) => k + 1);
                        update((d) => ({ ...d, files: [...d.files, ...picked] }));
                        clearError("files");
                      }}
                      className="h-9 text-sm file:me-2"
                    />
                    {draft.files.length > 0 && (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {draft.files.map((f, i) => (
                          <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs">
                            <Paperclip className="size-3 text-muted-foreground" aria-hidden="true" />
                            <span className="max-w-48 truncate">{f.name}</span>
                            <button
                              type="button"
                              onClick={() => update((d) => ({ ...d, files: d.files.filter((_, j) => j !== i) }))}
                              aria-label={t("payments.removeItem", { label: f.name })}
                              className="rounded-sm p-0.5 hover:bg-muted"
                            >
                              <X className="size-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Field>
                </div>

                {!editing && (
                  <div>
                    {showMore ? (
                      <Field htmlFor={fieldId("note")} label={t("common.note")} error={errors.fields.note}>
                        <Textarea
                          id={fieldId("note")}
                          value={draft.note}
                          rows={2}
                          onChange={(e) => {
                            const note = e.target.value;
                            update((d) => ({ ...d, note }));
                          }}
                          className="min-h-14 text-sm"
                        />
                      </Field>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setShowMore((v) => !v)}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {showMore ? <ChevronUp className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />}
                      {showMore ? t("common.fewerDetails") : t("common.moreDetails")}
                    </button>
                  </div>
                )}

                {/* 3. Lines */}
                <section aria-labelledby="pay-lines-heading" className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 id="pay-lines-heading" className="font-heading text-sm font-semibold">
                      {t("payments.lines")}
                    </h3>
                    <span className="text-xs text-muted-foreground">{t("payments.linesHelp")}</span>
                  </div>
                  {errors.fields.lines && (
                    <p id={fieldId("lines")} tabIndex={-1} role="alert" className="text-[11px] text-destructive">
                      {errors.fields.lines}
                    </p>
                  )}
                  {draft.lines.map((line, i) => (
                    <PaymentLineCard
                      key={line.uid}
                      line={line}
                      index={i}
                      errors={errors}
                      lookups={lookups}
                      sessionsOnOtherLines={sessionsOn(line.uid)}
                      purchasesOnOtherLines={purchasesOn(line.uid)}
                      canRemove={draft.lines.length > 1}
                      onChange={onLineChange(i)}
                      onRemove={() => {
                        update((d) => removeLine(d, line.uid));
                        setErrors((e) => ({ fields: Object.fromEntries(Object.entries(e.fields).filter(([k]) => !k.startsWith("lines."))), form: e.form }));
                      }}
                    />
                  ))}
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => update((d) => addLine(d))}>
                    <Plus className="size-4" />
                    {t("payments.addLine")}
                  </Button>
                </section>
                {/* Enter in a field submits; the visible Save is in the sticky footer. */}
                <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
              </form>
            )}
          </div>

          {/* 4. Sticky running total + Save */}
          <div className="flex items-center gap-3 border-t bg-card px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{t("payments.runningTotal")}</p>
              <p className="text-xl font-semibold tabular-nums" aria-live="polite">
                {formatMoney(total)}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving || !draft || Boolean(payment?.mistaken)}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.unsavedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.unsavedBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.keepEditing")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                setConfirmClose(false);
                onOpenChange(false);
              }}
            >
              {t("common.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DialogSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
