"use client";

import { useState } from "react";
import { HardHat, Loader2, MapPin, MoreHorizontal, Pencil, Phone, RotateCcw, Siren, Trash2, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { maintenanceCatalogService } from "@/lib/hooks/use-maintenance-catalog";
import { formatMoney } from "@/lib/maintenance/money";
import type { Technician } from "@/types/maintenance-system";
import { StarValue } from "./star-rating";
import { EMERGENCY_BADGE } from "./technicians-tab";

/**
 * Who the technician is: name, category, contact, rate, emergency
 * availability, the stores they cover. Edit is the card's action; delete and
 * restore sit in the "…" menu (a deleted technician keeps his history).
 */
export function TechnicianProfileCard({
  technician,
  canEdit,
  onEdit,
  onChanged,
}: {
  technician: Technician;
  canEdit: boolean;
  onEdit: () => void;
  onChanged: (next: Technician | null) => void;
}) {
  const t = useTranslations("maintenanceSystem");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const deleted = Boolean(technician.deletedAt);

  async function remove() {
    setBusy(true);
    try {
      await maintenanceCatalogService.deleteTechnician(technician.id);
      toast.success(t("technicians.deleted", { name: technician.name }));
      setConfirmDelete(false);
      onChanged(null);
    } catch (err) {
      toast.error(err instanceof MaintenanceTicketsError ? err.message : t("common.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    try {
      const restored = await maintenanceCatalogService.restoreTechnician(technician.id);
      toast.success(t("technicians.restored", { name: technician.name }));
      onChanged(restored);
    } catch (err) {
      toast.error(err instanceof MaintenanceTicketsError ? err.message : t("common.saveError"));
    } finally {
      setBusy(false);
    }
  }

  const stores = technician.coverageStores ?? [];

  return (
    <section aria-labelledby="technician-profile" className="rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
            <HardHat className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="technician-profile" className="font-heading text-base font-semibold">{t("technicians.profile")}</h2>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{technician.category?.name ?? t("technicians.noCategory")}</span>
              <StarValue value={technician.averageRating} />
              {technician.emergencyAvailable && (
                <span className={EMERGENCY_BADGE}>
                  <Siren className="h-3 w-3" aria-hidden="true" />
                  {t("technicians.standing.emergency")}
                </span>
              )}
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            {deleted ? (
              <Button variant="outline" size="sm" onClick={() => void restore()} disabled={busy}>
                {busy ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="me-1.5 h-4 w-4" aria-hidden="true" />}
                {t("technicians.restore")}
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Pencil className="me-1.5 h-4 w-4" aria-hidden="true" />
                  {t("common.edit")}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("workflow.moreActions")}>
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmDelete(true)}>
                      <Trash2 className="me-2 h-4 w-4" aria-hidden="true" />
                      {t("technicians.deleteTechnician")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        )}
      </header>

      <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">{t("common.phone")}</dt>
          <dd className="mt-0.5 tabular-nums">
            {technician.phone ? (
              <a href={`tel:${technician.phone}`} className="inline-flex items-center gap-1 hover:underline">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />{technician.phone}
              </a>
            ) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("technicians.contactPerson")}</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1">
            {technician.contactPerson ? <><User className="h-3.5 w-3.5" aria-hidden="true" />{technician.contactPerson}</> : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("technicians.hourlyRate")}</dt>
          <dd className="mt-0.5 tabular-nums">{technician.hourlyRate ? t("technicians.perHour", { amount: formatMoney(technician.hourlyRate) }) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("technicians.location")}</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1">
            {technician.location ? <><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{technician.location}</> : "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">{t("technicians.emergencyAvailable")}</dt>
          <dd className="mt-0.5">
            {technician.emergencyAvailable ? t("technicians.yes") : t("technicians.no")}
            {technician.emergencyAvailable && technician.emergencyNotes && (
              <span className="block whitespace-pre-line text-muted-foreground">{technician.emergencyNotes}</span>
            )}
          </dd>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <dt className="text-xs text-muted-foreground">{t("technicians.storesCovered")} <span className="tabular-nums">({stores.length})</span></dt>
          <dd className="mt-1">
            {stores.length === 0 ? (
              <span className="text-muted-foreground">{t("technicians.noStoresSet")}</span>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {stores.map((s) => (
                  <li key={s.id} className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs tabular-nums">{s.storeNumber}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        {technician.coverageNotes && (
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs text-muted-foreground">{t("technicians.coverageNotes")}</dt>
            <dd className="mt-0.5 whitespace-pre-line">{technician.coverageNotes}</dd>
          </div>
        )}
      </dl>

      <AlertDialog open={confirmDelete} onOpenChange={(next) => !next && !busy && setConfirmDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("technicians.deleteTitle", { name: technician.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("technicians.deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void remove();
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
    </section>
  );
}
