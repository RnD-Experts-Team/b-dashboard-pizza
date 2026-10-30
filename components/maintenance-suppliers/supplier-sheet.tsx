"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Pencil, Phone, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { EntityNotesAttachments } from "@/components/maintenance-tickets/entity-extras";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { maintenanceCatalogService, useSupplier } from "@/lib/hooks/use-maintenance-catalog";
import { formatMoney } from "@/lib/maintenance/money";
import type { Supplier } from "@/types/maintenance-v2";
import { PaymentsList } from "@/components/maintenance-technicians/payments-list";
import { SupplierFormDialog } from "./supplier-form-dialog";

const SKELETON_BLOCKS = 3;
/**
 * "http://" or "https://" at the start, any case: "https://acme.com", "HTTP://x.io" match; "acme.com", "ftp://x" do not.
 * https://regex101.com/?flavor=javascript&regex=%5Ehttps%3F%3A%5C%2F%5C%2F&flags=gim&testString=https%3A%2F%2Facme.com%0AHTTP%3A%2F%2Fx.io%0Aacme.com%0Aftp%3A%2F%2Fx
 */
const HAS_SCHEME = /^https?:\/\//i;

/** A website as typed ("acme.com") → a link that opens it. */
export function websiteHref(website: string): string {
  return HAS_SCHEME.test(website) ? website : `https://${website}`;
}

/**
 * One supplier in a side sheet (opened by `?supplier=ID`): contact details,
 * total paid ever, the latest payments, notes and files. Edit opens the same
 * dialog as Add; delete is a soft delete the list can restore.
 */
export function SupplierSheet({
  locale,
  supplierId,
  canEdit,
  onOpenChange,
  onChanged,
}: {
  locale: string;
  supplierId: number | null;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const { supplier, isLoading, error, refresh, setData } = useSupplier(supplierId);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function removeOrRestore(target: Supplier) {
    setBusy(true);
    try {
      if (target.deletedAt) {
        const restored = await maintenanceCatalogService.restoreSupplier(target.id);
        setData(restored);
        toast.success(t("suppliers.restored", { name: target.name }));
      } else {
        await maintenanceCatalogService.deleteSupplier(target.id);
        toast.success(t("suppliers.deleted", { name: target.name }));
        onOpenChange(false);
      }
      onChanged();
    } catch (err) {
      toast.error(err instanceof MaintenanceTicketsError ? err.message : t("common.saveError"));
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <Sheet open={supplierId !== null} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{supplier?.name ?? t("vocab.terms.supplier.label")}</SheetTitle>
            <SheetDescription>{supplier?.deletedAt ? t("suppliers.deletedNote") : t("vocab.terms.supplier.help")}</SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-4 pb-6">
            {isLoading && (
              <div className="space-y-3" aria-busy="true">
                {Array.from({ length: SKELETON_BLOCKS }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            )}

            {error && !isLoading && (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <span>{error.message}</span>
                <Button size="sm" variant="outline" onClick={() => void refresh()}>{t("common.retry")}</Button>
              </div>
            )}

            {supplier && !isLoading && (
              <>
                <section aria-labelledby="supplier-details" className="space-y-3">
                  <h3 id="supplier-details" className="sr-only">{t("suppliers.details")}</h3>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("technicians.totalPaid")}</p>
                    <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">{formatMoney(supplier.totalPaid ?? null)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("suppliers.totalPaidHelp")}</p>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">{t("common.phone")}</dt>
                    <dd className="tabular-nums">
                      {supplier.phone ? (
                        <a href={`tel:${supplier.phone}`} className="inline-flex items-center gap-1 hover:underline">
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />{supplier.phone}
                        </a>
                      ) : "—"}
                    </dd>
                    <dt className="text-muted-foreground">{t("technicians.website")}</dt>
                    <dd className="min-w-0">
                      {supplier.website ? (
                        <a href={websiteHref(supplier.website)} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-primary hover:underline">
                          <span className="truncate">{supplier.website}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        </a>
                      ) : "—"}
                    </dd>
                    {supplier.description && (
                      <>
                        <dt className="text-muted-foreground">{t("common.description")}</dt>
                        <dd className="whitespace-pre-line">{supplier.description}</dd>
                      </>
                    )}
                  </dl>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      {!supplier.deletedAt && (
                        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                          <Pencil className="me-1.5 h-4 w-4" aria-hidden="true" />
                          {t("common.edit")}
                        </Button>
                      )}
                      {supplier.deletedAt ? (
                        <Button variant="outline" size="sm" onClick={() => void removeOrRestore(supplier)} disabled={busy}>
                          {busy ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="me-1.5 h-4 w-4" aria-hidden="true" />}
                          {t("suppliers.restore")}
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                          <Trash2 className="me-1.5 h-4 w-4" aria-hidden="true" />
                          {t("common.delete")}
                        </Button>
                      )}
                    </div>
                  )}
                </section>

                <section aria-labelledby="supplier-payments" className="space-y-2">
                  <h3 id="supplier-payments" className="font-heading text-base font-semibold">{t("pages.payments")}</h3>
                  <PaymentsList
                    locale={locale}
                    filters={{ supplierId: supplier.id }}
                    allHref={`/${locale}/dashboard/maintenance-payments?supplier_id=${supplier.id}`}
                  />
                </section>

                <EntityNotesAttachments
                  entityPath={`/suppliers/${supplier.id}`}
                  notes={supplier.notes ?? []}
                  attachments={supplier.attachments ?? []}
                  onSuccess={() => void refresh()}
                  canAdd={canEdit}
                />
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {supplier && (
        <SupplierFormDialog
          open={editing}
          supplier={supplier}
          onOpenChange={setEditing}
          onSaved={(saved) => {
            setData((prev) => (prev ? { ...prev, ...saved } : saved));
            onChanged();
          }}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={(next) => !next && !busy && setConfirmDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("suppliers.deleteTitle", { name: supplier?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("suppliers.deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (supplier) void removeOrRestore(supplier);
              }}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
            >
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
