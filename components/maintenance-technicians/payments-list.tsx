"use client";

import Link from "next/link";
import { AlertCircle, Paperclip, Receipt } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePayments } from "@/lib/hooks/use-maintenance-payments";
import { formatMoney } from "@/lib/maintenance/money";
import { PAYMENT_LINE_TYPES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import { formatDateOnly } from "@/lib/utils/date-display";
import type { PaymentFilters } from "@/types/maintenance-v2";

/** The newest payments shown here; the Payments page has the rest. */
const RECENT_PAYMENTS = 10;
const SKELETON_ROWS = 3;

/** The Payments page opened on one payment (its detail sheet). */
export function paymentHref(locale: string, paymentId: number): string {
  return `/${locale}/dashboard/maintenance-payments?payment=${paymentId}`;
}

/**
 * The latest payments made to one technician or one supplier, newest first,
 * mistakes left out. Each row opens the payment on the Payments page; the
 * footer opens the Payments page filtered to them.
 */
export function PaymentsList({
  locale,
  filters,
  allHref,
}: {
  locale: string;
  filters: Pick<PaymentFilters, "technicianId" | "supplierId">;
  /** The Payments page filtered to this payee. */
  allHref: string;
}) {
  const t = useTranslations("maintenanceV2");
  const { payments, meta, totals, isLoading, error, refresh } = usePayments({ ...filters, perPage: RECENT_PAYMENTS });

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive">
        <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" aria-hidden="true" />{error.message}</span>
        <Button size="sm" variant="outline" onClick={() => void refresh()}>{t("common.retry")}</Button>
      </div>
    );
  }
  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
        <Receipt className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("technicians.noPayments")}</p>
      </div>
    );
  }

  const total = meta?.total ?? payments.length;
  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-lg border">
        {payments.map((p) => (
          <li key={p.id}>
            <Link
              href={paymentHref(locale, p.id)}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-medium">
                  {formatDateOnly(p.paidAt, "MMM d, yyyy")}
                  {p.hasInvoice && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-label={t("payments.invoiceFile")} />}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[
                    p.stores.join(", "),
                    p.types.map((type) => vocabText(t, vocabEntry(PAYMENT_LINE_TYPES, type))).join(", "),
                    p.invoiceNumber ? `${t("payments.invoiceNumber")} ${p.invoiceNumber}` : null,
                  ].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatMoney(p.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {totals ? t("technicians.paymentsTotal", { count: totals.count, total: formatMoney(totals.total) }) : null}
        </span>
        {total > payments.length && (
          <Link href={allHref} className="font-medium text-primary hover:underline">
            {t("technicians.allPayments", { count: total })}
          </Link>
        )}
      </div>
    </div>
  );
}
