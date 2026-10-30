"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { AlertCircle, ChevronLeft, ChevronRight, Plus, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuppliers, useTechnicianCategories, useTechnicians } from "@/lib/hooks/use-maintenance-catalog";
import { usePayments, useUnpaidWork } from "@/lib/hooks/use-maintenance-payments";
import { draftFromUnpaidWork } from "@/lib/maintenance-payments/form-state";
import {
  EMPTY_PAYMENTS_FILTERS,
  PAYMENT_PARAM,
  filtersFromParams,
  hasActiveFilters,
  paramsFromFilters,
  paymentIdFromParams,
  toPaymentFilters,
  type PaymentsPageFilters,
} from "@/lib/maintenance-payments/filters-url";
import { formatMoney } from "@/lib/maintenance/money";
import type { UnpaidWork } from "@/types/maintenance-v2";
import { PaymentDetailSheet } from "./payment-detail-sheet";
import { PaymentDialog, type PaymentPrefill } from "./payment-dialog";
import { PaymentsFilters } from "./payments-filters";
import { PaymentsTable } from "./payments-table";
import { UnpaidWorkPanel } from "./unpaid-work-panel";
import { useStoreOptions } from "./use-payment-lookups";

const PER_PAGE = 25;
const CATALOG_PAGE = 200;
const SKELETON_ROWS = 6;

type DialogState = { open: false } | { open: true; paymentId?: number; prefill?: PaymentPrefill };

/**
 * Payments `/dashboard/maintenance-payments` (docs/MAINTENANCE-V2-UI.md §5):
 * header + primary Record a payment, one filter row, KPI strip, the list,
 * and the Unpaid work panel. Filters and the open payment live in the URL.
 */
export function PaymentsPage() {
  const t = useTranslations("maintenanceV2");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => filtersFromParams(new URLSearchParams(searchParams.toString())), [searchParams]);
  const openPaymentId = useMemo(() => paymentIdFromParams(new URLSearchParams(searchParams.toString())), [searchParams]);

  const writeParams = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const setFilters = (patch: Partial<PaymentsPageFilters>) => {
    const next = { ...filters, ...patch, page: patch.page ?? 1 };
    writeParams(paramsFromFilters(next, new URLSearchParams(searchParams.toString())));
  };
  const setOpenPayment = (id: number | null) => {
    const p = new URLSearchParams(searchParams.toString());
    if (id) p.set(PAYMENT_PARAM, String(id));
    else p.delete(PAYMENT_PARAM);
    writeParams(p);
  };

  /* ── Data ─────────────────────────────────────────────────────────── */

  const list = usePayments(toPaymentFilters(filters, PER_PAGE));
  const unpaid = useUnpaidWork();
  const { technicians } = useTechnicians({ perPage: CATALOG_PAGE, withTrashed: true });
  const { suppliers } = useSuppliers({ perPage: CATALOG_PAGE, withTrashed: true });
  const { categories } = useTechnicianCategories();
  const { stores, resolveStoreId } = useStoreOptions();

  const refreshAll = () => {
    void list.refresh();
    void unpaid.refresh();
  };

  /* ── Dialog ───────────────────────────────────────────────────────── */

  const [dialog, setDialog] = useState<DialogState>({ open: false });
  /** Bumped after a save so the open detail sheet reads the payment again. */
  const [version, setVersion] = useState(0);

  const payThis = (work: UnpaidWork) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const draft = draftFromUnpaidWork(work, today, {}, resolveStoreId);
    setDialog({ open: true, prefill: { technicianId: work.technician.id, lines: draft.lines } });
  };

  /* ── Render ───────────────────────────────────────────────────────── */

  const meta = list.meta;
  const totals = list.totals;
  const showSkeleton = list.isLoading && list.payments.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t("pages.payments")} description={t("payments.pageDescription")}>
        <Button onClick={() => setDialog({ open: true })} className="gap-1.5">
          <Plus className="size-4" />
          {t("payments.recordPayment")}
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <PaymentsFilters
            filters={filters}
            onChange={setFilters}
            onClear={() => writeParams(paramsFromFilters(EMPTY_PAYMENTS_FILTERS, new URLSearchParams(searchParams.toString())))}
            onRefresh={refreshAll}
            refreshing={list.isRefreshing}
            technicians={technicians}
            suppliers={suppliers}
            categories={categories}
            stores={stores}
          />

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            <Kpi label={t("payments.kpiPayments")} value={totals ? String(totals.count) : "—"} loading={showSkeleton} />
            <Kpi label={t("payments.kpiTotal")} value={totals ? formatMoney(totals.total) : "—"} loading={showSkeleton} />
          </div>

          {showSkeleton && (
            <div className="space-y-2">
              {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {list.error && list.payments.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <AlertCircle className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{list.error.message || t("common.loadError")}</p>
              <Button variant="outline" onClick={() => void list.refresh()}>
                {t("common.retry")}
              </Button>
            </div>
          )}

          {!list.isLoading && !list.error && list.payments.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
              <Wallet className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters(filters) ? t("payments.emptyFiltered") : t("payments.empty")}
              </p>
              {hasActiveFilters(filters) ? (
                <Button
                  variant="outline"
                  onClick={() => writeParams(paramsFromFilters(EMPTY_PAYMENTS_FILTERS, new URLSearchParams(searchParams.toString())))}
                >
                  {t("common.clearAll")}
                </Button>
              ) : (
                <Button onClick={() => setDialog({ open: true })}>{t("payments.recordPayment")}</Button>
              )}
            </div>
          )}

          {list.payments.length > 0 && <PaymentsTable rows={list.payments} onOpen={setOpenPayment} />}

          {meta && meta.lastPage > 1 && (
            <nav className="flex items-center justify-between gap-2" aria-label={t("payments.pagination")}>
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("payments.pageOf", { page: meta.currentPage, pages: meta.lastPage })}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.currentPage <= 1}
                  onClick={() => setFilters({ page: meta.currentPage - 1 })}
                  aria-label={t("payments.previousPage")}
                >
                  <ChevronLeft className="size-4 rtl:rotate-180" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.currentPage >= meta.lastPage}
                  onClick={() => setFilters({ page: meta.currentPage + 1 })}
                  aria-label={t("payments.nextPage")}
                >
                  <ChevronRight className="size-4 rtl:rotate-180" />
                </Button>
              </div>
            </nav>
          )}
        </div>

        <aside className="min-w-0">
          <UnpaidWorkPanel
            work={unpaid.unpaidWork}
            isLoading={unpaid.isLoading}
            error={unpaid.error}
            onRetry={() => void unpaid.refresh()}
            onPay={payThis}
          />
        </aside>
      </div>

      <PaymentDetailSheet
        key={version}
        paymentId={openPaymentId}
        onClose={() => setOpenPayment(null)}
        onEdit={(id) => setDialog({ open: true, paymentId: id })}
        onChanged={refreshAll}
      />

      <PaymentDialog
        open={dialog.open}
        onOpenChange={(open) => !open && setDialog({ open: false })}
        paymentId={dialog.open ? dialog.paymentId : undefined}
        prefill={dialog.open ? dialog.prefill : undefined}
        onSaved={(id) => {
          refreshAll();
          setVersion((v) => v + 1);
          setOpenPayment(id);
        }}
      />
    </div>
  );
}

function Kpi({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="mt-1 h-6 w-20" /> : <p className="text-xl font-semibold tabular-nums">{value}</p>}
    </div>
  );
}
