"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { format, isValid, parseISO } from "date-fns";
import { toast } from "sonner";
import { AlertCircle, History, Loader2, Pencil, Undo2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentGallery } from "@/components/maintenance-tickets/attachment-gallery";
import { LocalTimestamp } from "@/components/maintenance-tickets/local-timestamp";
import { NotesList } from "@/components/maintenance-tickets/notes-list";
import { maintenancePaymentsService, usePayment } from "@/lib/hooks/use-maintenance-payments";
import { useMaintenanceMutation } from "@/lib/hooks/use-maintenance-resource";
import { formErrorsFrom } from "@/lib/maintenance-payments/field-errors";
import { formatHours, formatMinutes, formatMoney, formatQuantity } from "@/lib/maintenance/money";
import {
  PAID_TO_TYPES,
  PARTS_DESTINATIONS,
  PAYMENT_LINE_TYPES,
  PAYMENT_METHODS,
  vocabEntry,
  vocabText,
} from "@/lib/maintenance/vocabulary";
import type { Payment, PaymentLine } from "@/types/maintenance-v2";
import { LINE_TYPE_ICONS } from "./line-type-badges";

export function formatPaidDate(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MMM d, yyyy") : iso;
}

/**
 * One payment: who, when, how; its lines with what each links to (tickets,
 * clocked time, stock, serials, purchases paid back); files, notes and
 * revisions. Edit and Mark as mistake (confirmed, with a reason).
 */
export function PaymentDetailSheet({
  paymentId,
  onClose,
  onEdit,
  onChanged,
}: {
  paymentId: number | null;
  onClose: () => void;
  onEdit: (paymentId: number) => void;
  /** After a write, so the list refetches. */
  onChanged: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const { payment, isLoading, error, refresh } = usePayment(paymentId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Sheet open={paymentId != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-4 text-start">
          <SheetTitle className="font-heading font-semibold">
            {payment ? t("payments.detailTitle", { id: payment.id }) : t("pages.payments")}
          </SheetTitle>
          <SheetDescription>
            {payment ? `${payment.paidTo.name} · ${formatPaidDate(payment.paidAt)}` : t("payments.detailDescription")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading && !payment && (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          )}
          {error && !payment && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
              <AlertCircle className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{error.message || t("common.loadError")}</p>
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                {t("common.retry")}
              </Button>
            </div>
          )}
          {payment && <PaymentDetailBody payment={payment} />}
        </div>

        {payment && !payment.mistaken && (
          <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Undo2 className="size-4" />
              {t("common.markAsMistake")}
            </Button>
            <Button onClick={() => onEdit(payment.id)}>
              <Pencil className="size-4" />
              {t("common.edit")}
            </Button>
          </div>
        )}

        {payment && (
          <MarkMistakeDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            payment={payment}
            onDone={() => {
              void refresh();
              onChanged();
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PaymentDetailBody({ payment }: { payment: Payment }) {
  const t = useTranslations("maintenanceV2");
  const method = vocabEntry(PAYMENT_METHODS, payment.method);
  const facts: { label: string; value: string }[] = [
    { label: t("payments.paidTo"), value: `${payment.paidTo.name} (${vocabText(t, vocabEntry(PAID_TO_TYPES, payment.paidTo.type))})` },
    { label: t("common.date"), value: formatPaidDate(payment.paidAt) },
    { label: t("payments.howWePaid"), value: method ? vocabText(t, method) : t("payments.methodNotSaid") },
    { label: t("payments.reference"), value: payment.reference || "—" },
    { label: t("payments.invoiceNumber"), value: payment.invoiceNumber || "—" },
  ];

  return (
    <div className="space-y-5">
      {payment.mistaken && (
        <div role="status" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <p className="font-medium">{t("payments.mistakenBanner")}</p>
          {payment.mistakenReason && <p className="text-xs">{payment.mistakenReason}</p>}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border bg-card p-3">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</dt>
            <dd className="truncate text-sm">{f.value}</dd>
          </div>
        ))}
        <div className="min-w-0">
          <dt className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{t("common.total")}</dt>
          <dd className={payment.mistaken ? "text-xl font-semibold tabular-nums line-through" : "text-xl font-semibold tabular-nums"}>
            {formatMoney(payment.total)}
          </dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h3 className="font-heading text-sm font-semibold">{t("payments.lines")}</h3>
        {payment.lines.map((line) => (
          <LineDetail key={line.id} line={line} />
        ))}
      </section>

      {payment.attachments.length > 0 && (
        <section className="space-y-1">
          <h3 className="font-heading text-sm font-semibold">{t("common.files")}</h3>
          <AttachmentGallery attachments={payment.attachments} />
        </section>
      )}

      {payment.notes.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="font-heading text-sm font-semibold">{t("common.notes")}</h3>
          <NotesList notes={payment.notes} />
        </section>
      )}

      <section className="space-y-1.5">
        <h3 className="flex items-center gap-1.5 font-heading text-sm font-semibold">
          <History className="size-4 text-muted-foreground" aria-hidden="true" />
          {t("payments.revisions")}
        </h3>
        {payment.revisions.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("payments.noRevisions")}</p>
        ) : (
          <ul className="space-y-1">
            {payment.revisions.map((r) => {
              const who = typeof r.editedBy === "string" ? r.editedBy : r.editedBy?.name;
              return (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
                  <span className="font-medium">{who || t("payments.someone")}</span>
                  <span className="text-muted-foreground">{t("payments.editedIt")}</span>
                  <LocalTimestamp iso={r.createdAt} showZone={false} className="text-muted-foreground" />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function LineDetail({ line }: { line: PaymentLine }) {
  const t = useTranslations("maintenanceV2");
  const locale = useLocale();
  const Icon = LINE_TYPE_ICONS[line.type];
  // Parts into storage: the location, then the spot the part sits in there now ("Zone A › Shelf 3").
  const spot = (line.place ?? []).map((p) => p.value).filter(Boolean);
  const where =
    (line.storageLocation ? [line.storageLocation.name, ...spot].join(" › ") : null) ??
    (line.store ? t("payments.storeNumber", { number: line.store.storeNumber }) : line.otherStore) ??
    "—";

  const howMuch: Record<PaymentLine["type"], string | null> = {
    hourly: line.hours ? `${formatHours(line.hours)} × ${formatMoney(line.rate)}` : null,
    parts: line.quantity ? `${formatQuantity(line.quantity)} × ${formatMoney(line.unitCost)}` : null,
    gas: line.miles ? t("payments.milesTimesRate", { miles: formatQuantity(line.miles), rate: formatMoney(line.rate) }) : null,
    fixed: null,
    inspection: null,
    other: null,
  };

  return (
    <div className="rounded-lg border bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            {vocabText(t, vocabEntry(PAYMENT_LINE_TYPES, line.type, line.typeLabel))}
            {line.hoursOverridden && (
              <Badge variant="outline" className="border-amber-500/40 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-400">
                {t("payments.typedOver")}
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {[where, line.part?.name, line.destination ? vocabText(t, vocabEntry(PARTS_DESTINATIONS, line.destination)) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="shrink-0 text-end">
          <p className="font-semibold tabular-nums">{formatMoney(line.amount)}</p>
          {howMuch[line.type] && <p className="text-[11px] text-muted-foreground tabular-nums">{howMuch[line.type]}</p>}
        </div>
      </div>

      {line.description && <p className="mt-1.5 text-xs">{line.description}</p>}

      <div className="mt-2 space-y-1 text-xs">
        {line.boughtFrom && (
          <p>
            <span className="text-muted-foreground">{t("payments.boughtFrom")}: </span>
            {line.boughtFrom.name}
          </p>
        )}
        {line.ticketIssues.length > 0 && (
          <p className="flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground">{t("payments.tickets")}:</span>
            {line.ticketIssues.map((i) => (
              <Link
                key={i.id}
                href={`/${locale}/dashboard/maintenance-tickets/${i.ticketId}?issue=${i.id}`}
                className="text-primary hover:underline"
              >
                #{i.ticketId} · {i.title}
              </Link>
            ))}
          </p>
        )}
        {line.tripSessions.length > 0 && (
          <div>
            <span className="text-muted-foreground">{t("payments.clockedTime")}:</span>
            <ul className="mt-0.5 space-y-0.5">
              {line.tripSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 tabular-nums">
                  <LocalTimestamp iso={s.clockIn} showZone={false} />
                  <span>{formatMinutes(s.paidMinutes)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {line.serials.length > 0 && (
          <p>
            <span className="text-muted-foreground">{t("payments.serialNumbers")}: </span>
            <span className="font-mono">{line.serials.join(", ")}</span>
          </p>
        )}
        {line.technicianPurchases.length > 0 && (
          <p>
            <span className="text-muted-foreground">{t("payments.paysBack")}: </span>
            {line.technicianPurchases.map((p) => `${p.description} (${formatMoney(p.totalCost)})`).join(", ")}
          </p>
        )}
        {line.stockMovementId != null && (
          <p>
            <Link href={`/${locale}/dashboard/storage?tab=movements`} className="text-primary hover:underline">
              {t("payments.stockMovement", { id: line.stockMovementId })}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

/** "Mark as mistake": confirmation with a required reason, styled destructive. */
function MarkMistakeDialog({
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
  const t = useTranslations("maintenanceV2");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mark = useMaintenanceMutation(maintenancePaymentsService.markPaymentMistaken);

  const submit = async () => {
    if (!reason.trim()) {
      setError(t("payments.reasonRequired"));
      return;
    }
    try {
      await mark.run(payment.id, { reason: reason.trim() });
      toast.success(t("payments.markedMistaken"));
      onOpenChange(false);
      setReason("");
      onDone();
    } catch (err) {
      const parsed = formErrorsFrom(err, { rootFields: ["reason", "status"] });
      setError(parsed.fields.reason ?? parsed.fields.status ?? parsed.form[0] ?? null);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !mark.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("payments.markMistakeTitle", { id: payment.id })}</AlertDialogTitle>
          <AlertDialogDescription>{t("payments.markMistakeBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1">
          <Label htmlFor="pay-mistake-reason" className="text-xs font-medium">
            {t("common.reason")}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <Textarea
            id="pay-mistake-reason"
            value={reason}
            rows={3}
            autoFocus
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            aria-invalid={Boolean(error) || undefined}
          />
          {error ? (
            <p role="alert" className="text-[11px] text-destructive">
              {error}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">{t("common.reasonHelp")}</p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mark.isPending}>{t("common.cancel")}</AlertDialogCancel>
          <Button variant="destructive" disabled={mark.isPending} onClick={() => void submit()}>
            {mark.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("common.markAsMistake")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
