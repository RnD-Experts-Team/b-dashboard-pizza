"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { maintenancePaymentsService } from "@/lib/hooks/use-maintenance-payments";
import { useMaintenanceMutation } from "@/lib/hooks/use-maintenance-resource";
import { formErrorsFrom } from "@/lib/maintenance-payments/field-errors";
import { decimalOr0, formatMoney, parseDecimal, roundCents, toMoneyString } from "@/lib/maintenance/money";
import { PAYMENT_LINE_TYPES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import type { Payment, PaymentLine } from "@/types/maintenance-system";
import { PaymentMethodSelect } from "./payment-methods";

const ISO_DAY = "yyyy-MM-dd";
const ROOT_FIELDS = ["refunded_at", "payment_method_id", "reference", "reason", "lines", "status"] as const;

/**
 * A server error key for one sent line, capturing its position: "lines.2.amount" matches (2);
 * "lines" and "lines.x.amount" do not.
 * https://regex101.com/?flavor=javascript&regex=%5Elines%5C.(%5Cd%2B)%5C.&flags=gm&testString=lines.2.amount%0Alines%0Alines.x.amount
 */
const SENT_LINE_KEY = /^lines\.(\d+)\./;

/** Where a line's money went, in words. */
function lineWhere(t: ReturnType<typeof useTranslations>, line: PaymentLine): string {
  return (
    line.storageLocation?.name ??
    (line.store ? t("payments.storeNumber", { number: line.store.storeNumber }) : line.otherStore) ??
    "—"
  );
}

/**
 * "Record a refund": money that came back for this payment (a return, a
 * cancelled order, an overcharge). One amount per line, at most what that
 * line still has unrefunded; when it came back, how, and why. The refund is
 * kept as its own record dated when the money came back, so every total nets it.
 */
export function RecordRefundDialog({
  open,
  onOpenChange,
  payment,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment;
  onDone: () => void;
}) {
  const t = useTranslations("maintenanceSystem");
  const today = format(new Date(), ISO_DAY);
  const lines = useMemo(() => payment.lines.filter((l) => decimalOr0(l.refundable) > 0), [payment.lines]);

  const [refundedAt, setRefundedAt] = useState(today);
  const [methodId, setMethodId] = useState<number | null>(payment.paymentMethod?.id ?? null);
  const [reason, setReason] = useState("");
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const save = useMaintenanceMutation(maintenancePaymentsService.createRefund);

  const total = roundCents(lines.reduce((sum, l) => sum + decimalOr0(amounts[l.id]), 0));
  const fillAll = () => setAmounts(Object.fromEntries(lines.map((l) => [l.id, l.refundable ?? "0.00"])));

  const reset = () => {
    setRefundedAt(today);
    setMethodId(payment.paymentMethod?.id ?? null);
    setReason("");
    setAmounts({});
    setErrors({});
    setFormError(null);
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    const picked = lines
      .map((l) => ({ line: l, amount: parseDecimal(amounts[l.id]) }))
      .filter((p) => p.amount != null && p.amount !== 0);

    picked.forEach(({ line, amount }) => {
      if (amount == null || amount < 0) next[`line.${line.id}`] = t("payments.refunds.amountPositive");
      else if (amount > decimalOr0(line.refundable)) next[`line.${line.id}`] = t("payments.refunds.atMost", { amount: formatMoney(line.refundable) });
    });
    if (!refundedAt) next.refunded_at = t("payments.refunds.dateRequired");
    if (!reason.trim()) next.reason = t("payments.refunds.reasonRequired");
    if (picked.length === 0) next.lines = t("payments.refunds.pickAmount");
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    try {
      await save.run(payment.id, {
        refundedAt,
        paymentMethodId: methodId,
        reason: reason.trim(),
        lines: picked.map(({ line, amount }) => ({ lineId: line.id, amount: toMoneyString(amount as number) })),
      });
      toast.success(t("payments.refunds.recorded", { amount: formatMoney(total) }));
      reset();
      onOpenChange(false);
      onDone();
    } catch (err) {
      const parsed = formErrorsFrom(err, { rootFields: ROOT_FIELDS, itemArrays: ["lines"] });
      // Line errors come back by position in what was sent: map them to the line shown.
      const mapped: Record<string, string> = {};
      Object.entries(parsed.fields).forEach(([key, message]) => {
        const m = SENT_LINE_KEY.exec(key);
        if (m) {
          const sent = picked[Number(m[1])];
          if (sent) mapped[`line.${sent.line.id}`] = message;
        } else {
          mapped[key] = message;
        }
      });
      setErrors(mapped);
      setFormError(mapped.status ?? mapped.lines ?? parsed.form[0] ?? null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (save.isPending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("payments.refunds.recordTitle", { id: payment.id })}</DialogTitle>
          <DialogDescription>{t("payments.refunds.recordBody")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="refund-date" className="text-xs font-medium">
                {t("payments.refunds.cameBackOn")}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="refund-date"
                type="date"
                className="h-9"
                value={refundedAt}
                min={payment.paidAt}
                max={today}
                onChange={(e) => setRefundedAt(e.target.value)}
                aria-invalid={Boolean(errors.refunded_at) || undefined}
              />
              {errors.refunded_at && (
                <p role="alert" className="text-[11px] text-destructive">
                  {errors.refunded_at}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="refund-method" className="text-xs font-medium">
                {t("payments.refunds.howItCameBack")}
              </Label>
              <PaymentMethodSelect id="refund-method" value={methodId} onChange={setMethodId} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <legend className="text-xs font-medium">{t("payments.refunds.whatCameBack")}</legend>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={fillAll}>
                {t("payments.refunds.fullRefund")}
              </Button>
            </div>
            <ul className="space-y-2">
              {lines.map((line) => {
                const key = `line.${line.id}`;
                const inputId = `refund-line-${line.id}`;
                return (
                  <li key={line.id} className="rounded-md border p-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <label htmlFor={inputId} className="min-w-0 text-sm">
                        <span className="font-medium">{vocabText(t, vocabEntry(PAYMENT_LINE_TYPES, line.type, line.typeLabel))}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[lineWhere(t, line), line.description].filter(Boolean).join(" · ")}
                        </span>
                        <span className="block text-[11px] text-muted-foreground tabular-nums">
                          {t("payments.refunds.paidAndLeft", { paid: formatMoney(line.amount), left: formatMoney(line.refundable) })}
                        </span>
                      </label>
                      <Input
                        id={inputId}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="h-9 w-28 shrink-0 text-end tabular-nums"
                        value={amounts[line.id] ?? ""}
                        onChange={(e) => {
                          setAmounts((prev) => ({ ...prev, [line.id]: e.target.value }));
                          setErrors((prev) => ({ ...prev, [key]: "", lines: "" }));
                        }}
                        aria-invalid={Boolean(errors[key]) || undefined}
                        aria-describedby={errors[key] ? `${inputId}-error` : undefined}
                      />
                    </div>
                    {errors[key] && (
                      <p id={`${inputId}-error`} role="alert" className="mt-1 text-[11px] text-destructive">
                        {errors[key]}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            {errors.lines && (
              <p role="alert" className="text-[11px] text-destructive">
                {errors.lines}
              </p>
            )}
          </fieldset>

          <div className="space-y-1">
            <Label htmlFor="refund-reason" className="text-xs font-medium">
              {t("payments.refunds.why")}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Textarea
              id="refund-reason"
              rows={2}
              value={reason}
              placeholder={t("payments.refunds.whyPlaceholder")}
              onChange={(e) => {
                setReason(e.target.value);
                setErrors((prev) => ({ ...prev, reason: "" }));
              }}
              aria-invalid={Boolean(errors.reason) || undefined}
            />
            {errors.reason && (
              <p role="alert" className="text-[11px] text-destructive">
                {errors.reason}
              </p>
            )}
          </div>

          <div className="flex items-baseline justify-between rounded-md bg-muted/50 px-3 py-2">
            <span className="text-sm">{t("payments.refunds.totalBack")}</span>
            <span className="text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
          </div>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending} onClick={() => void submit()}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("payments.refunds.record")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
