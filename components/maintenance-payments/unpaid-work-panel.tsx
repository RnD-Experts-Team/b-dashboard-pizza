"use client";

import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, Clock, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { decimalOr0, formatMinutes, formatMoney, minutesToHours } from "@/lib/maintenance/money";
import type { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import type { UnpaidWork } from "@/types/maintenance-v2";

const SKELETON_ROWS = 3;

/**
 * Unpaid work (UI doc §5 side panel): per technician, clocked time not paid
 * and purchases not paid back, each with "Pay this" — which opens the
 * payment dialog already filled in.
 */
export function UnpaidWorkPanel({
  work,
  isLoading,
  error,
  onRetry,
  onPay,
}: {
  work: UnpaidWork[];
  isLoading: boolean;
  error: MaintenanceTicketsError | null;
  onRetry: () => void;
  onPay: (work: UnpaidWork) => void;
}) {
  const t = useTranslations("maintenanceV2");

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="font-heading text-base font-semibold">{t("payments.unpaidWork")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("vocab.terms.unpaidWork.help")}</p>
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        {isLoading && work.length === 0 &&
          Array.from({ length: SKELETON_ROWS }, (_, i) => <Skeleton key={i} className="h-20 w-full" />)}

        {error && work.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center">
            <AlertCircle className="size-5 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">{error.message || t("common.loadError")}</p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              {t("common.retry")}
            </Button>
          </div>
        )}

        {!isLoading && !error && work.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center">
            <CheckCircle2 className="size-5 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">{t("payments.allPaidUp")}</p>
          </div>
        )}

        {work.map((w) => {
          const minutes = w.totals.paidMinutes;
          const rate = decimalOr0(w.technician.hourlyRate);
          const estimate = rate ? minutesToHours(minutes) * rate + decimalOr0(w.totals.purchasesTotal) : null;
          return (
            <div key={w.technician.id} className="rounded-lg border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{w.technician.name}</p>
                  {estimate != null && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {t("payments.aboutOwed", { amount: formatMoney(estimate) })}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => onPay(w)}>
                  {t("payments.payThis")}
                </Button>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">{t("payments.clockedNotPaid")}</dt>
                  <dd className="tabular-nums">
                    {t("payments.sessionsCount", { count: w.sessions.length, time: formatMinutes(minutes) })}
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">{t("payments.purchasesNotPaidBack")}</dt>
                  <dd className="tabular-nums">
                    {t("payments.purchasesCount", { count: w.purchases.length, total: formatMoney(w.totals.purchasesTotal) })}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
