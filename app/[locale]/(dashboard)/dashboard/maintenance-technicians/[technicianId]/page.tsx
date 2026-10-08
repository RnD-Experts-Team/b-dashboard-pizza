"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, HardHat, Loader2, MapPin, Pencil, Phone, RefreshCw, RotateCcw, Star, StickyNote, Store as StoreIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth/use-auth";
import { useMaintenanceTicketsCatalogStore } from "@/lib/store/maintenance-tickets-catalog.store";
import { useTechnicianAnalytics } from "@/lib/hooks/use-technician-analytics";
import {
  entityPaths,
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { AnalyticsCard } from "@/components/maintenance-tickets/analytics/analytics-card";
import { EntityNotesAttachments } from "@/components/maintenance-tickets/entity-extras";
import { TechnicianAbilitiesEditor, TechnicianRatingSummary } from "@/components/maintenance-tickets/technician-abilities-editor";
import { TechnicianFilters, useTechnicianFilters } from "@/components/maintenance-tickets/technicians/technician-filters";
import { TechnicianFormDialog } from "@/components/maintenance-tickets/technicians/technician-form-dialog";
import { TechnicianReport } from "@/components/maintenance-tickets/technicians/technician-report";
import type { CatalogTechnician } from "@/types/maintenance-tickets.types";

/**
 * One technician: who they are and where they cover, how they are rated,
 * notes and files about them -- then their pay and work for a range.
 */
export default function TechnicianPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const technicianId = Number(params?.technicianId);
  const { canAccessRoute } = useAuth();
  const canEdit = canAccessRoute({ service: "Maintenance", method: "PATCH", path: "/technicians/placeholder" });
  const canReadRatings = canAccessRoute({ service: "Maintenance", method: "GET", path: "/technician-abilities" });
  const canRate = canAccessRoute({ service: "Maintenance", method: "PATCH", path: "/technicians/placeholder/rating" });
  const loadCatalog = useMaintenanceTicketsCatalogStore((s) => s.loadCatalog);

  const [technician, setTechnician] = useState<CatalogTechnician | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(false);
  const [busy, setBusy] = useState(false);

  const filters = useTechnicianFilters();
  const report = useTechnicianAnalytics(technicianId);

  const loadTechnician = useCallback(async () => {
    setLoadError(null);
    try {
      setTechnician(await maintenanceTicketsService.getTechnician(technicianId));
    } catch (err) {
      setLoadError(err instanceof MaintenanceTicketsError ? err.message : "Could not load this technician.");
    }
  }, [technicianId]);

  useEffect(() => {
    void loadTechnician();
  }, [loadTechnician]);

  // Ratings read the issue catalog and the ratings board from the catalog store.
  useEffect(() => {
    if (canReadRatings) void loadCatalog();
  }, [canReadRatings, loadCatalog]);

  const { load } = report;
  const reload = useCallback(() => {
    if (filters.params) void load(filters.params);
  }, [filters.params, load]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function removeOrRestore() {
    if (!technician) return;
    const deleting = !technician.deletedAt;
    if (deleting && !window.confirm(`Delete ${technician.name}? Their pay and work history stay; they can be restored.`)) return;
    setBusy(true);
    try {
      if (deleting) await maintenanceTicketsService.deleteCatalogTechnician(technician.id);
      else await maintenanceTicketsService.restoreCatalogTechnician(technician.id);
      toast.success(deleting ? `${technician.name} was deleted.` : `${technician.name} is back.`);
      await loadTechnician();
    } catch (err) {
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ms-2">
      <Link href={`/${locale}/dashboard/maintenance-technicians`}>
        <ArrowLeft className="me-1.5 h-4 w-4" aria-hidden="true" /> All technicians
      </Link>
    </Button>
  );

  if (loadError) {
    return (
      <div className="space-y-6">
        {back}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => void loadTechnician()}>
            <RotateCcw className="me-1.5 h-3.5 w-3.5" aria-hidden="true" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!technician) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading the technician">
        {back}
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    );
  }

  const coverage = technician.coverageStores ?? [];
  const mapsUrl = technician.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(technician.location)}` : null;

  return (
    <div className="space-y-6">
      {back}

      <PageHeader
        title={technician.name}
        description={[technician.categoryName ?? "No category", technician.deletedAt ? "Deleted" : null].filter(Boolean).join(" · ")}
      >
        {canEdit && !technician.deletedAt && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="me-2 h-4 w-4" aria-hidden="true" /> Edit
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" onClick={() => void removeOrRestore()} disabled={busy} className={technician.deletedAt ? undefined : "text-destructive hover:text-destructive"}>
            {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : technician.deletedAt ? <RotateCcw className="me-2 h-4 w-4" aria-hidden="true" /> : <Trash2 className="me-2 h-4 w-4" aria-hidden="true" />}
            {technician.deletedAt ? "Restore" : "Delete"}
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsCard icon={StoreIcon} title="Profile and coverage" description="How to reach them, where they are based, and the stores they cover.">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" aria-hidden="true" /> Phone</dt>
              <dd className="mt-0.5 font-medium">
                {technician.phone ? <a href={`tel:${technician.phone}`} className="text-primary hover:underline">{technician.phone}</a> : "—"}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-muted-foreground"><HardHat className="h-3.5 w-3.5" aria-hidden="true" /> Category</dt>
              <dd className="mt-0.5 font-medium">{technician.categoryName ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Location</dt>
              <dd className="mt-0.5 font-medium">
                {technician.location ?? "—"}
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="ms-2 inline-flex items-center gap-1 text-sm font-normal text-primary hover:underline">
                    Open in Maps <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Stores they cover ({coverage.length})</dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {coverage.length === 0 ? (
                  <span className="text-muted-foreground">None set yet.{canEdit ? " Edit to add the stores they can reach." : ""}</span>
                ) : (
                  coverage.map((s) => (
                    <span key={s.id} className="rounded-md bg-muted px-2 py-1 text-xs font-medium tabular-nums">{s.storeNumber}</span>
                  ))
                )}
              </dd>
            </div>
            {technician.coverageNotes && (
              <div className="sm:col-span-2">
                <dt className="flex items-center gap-1.5 text-muted-foreground"><StickyNote className="h-3.5 w-3.5" aria-hidden="true" /> Coverage notes</dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{technician.coverageNotes}</dd>
              </div>
            )}
          </dl>
        </AnalyticsCard>

        <div className="space-y-6">
          {canReadRatings && (
            <AnalyticsCard
              icon={Star}
              title="Ratings"
              description="Stars per issue and overall, and who to call first. They order the technician pickers on tickets."
              action={canRate && !technician.deletedAt ? (
                <Button variant="outline" size="sm" onClick={() => setRating((v) => !v)}>
                  {rating ? "Close" : "Rate"}
                </Button>
              ) : undefined}
            >
              <TechnicianRatingSummary technician={technician} />
              {rating && <div className="mt-3"><TechnicianAbilitiesEditor technician={technician} /></div>}
            </AnalyticsCard>
          )}

          <AnalyticsCard icon={StickyNote} title="Notes and files" description="Anything worth knowing about working with them.">
            <EntityNotesAttachments
              entityPath={entityPaths.technician(technician.id)}
              notes={technician.notes}
              attachments={technician.attachments}
              onSuccess={() => void loadTechnician()}
              allowNoteType
              canAdd={canEdit && !technician.deletedAt}
              alwaysOpen
            />
          </AnalyticsCard>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h2 className="font-heading text-xl font-semibold">Pay and work</h2>
          <p className="text-sm text-muted-foreground">From the daily pay sheets and their visits.</p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={report.isLoading}>
          <RefreshCw className={report.isLoading ? "me-1.5 h-3.5 w-3.5 animate-spin" : "me-1.5 h-3.5 w-3.5"} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <TechnicianFilters filters={filters} showCategory={false} isUpdating={report.isLoading && report.loadedParams !== null} />

      {!report.loadedParams ? (
        <div className="space-y-6" aria-busy="true" aria-label="Loading the report">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className={report.isLoading ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"}>
          <TechnicianReport
            key={JSON.stringify(report.loadedParams)}
            locale={locale}
            technicianId={technician.id}
            data={report.data}
            error={report.error}
            rangeLabel={filters.rangeLabel}
          />
        </div>
      )}

      <TechnicianFormDialog
        open={editing}
        technician={technician}
        onClose={() => setEditing(false)}
        onSaved={(saved) => setTechnician(saved)}
      />
    </div>
  );
}
