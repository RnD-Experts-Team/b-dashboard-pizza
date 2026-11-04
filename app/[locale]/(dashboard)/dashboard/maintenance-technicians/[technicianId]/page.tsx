"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, BarChart3, HardHat, Receipt, Route } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth/use-auth";
import { entityPaths } from "@/lib/api/services/maintenance-tickets.service";
import { useTechnician } from "@/lib/hooks/use-maintenance-catalog";
import { useTechnicianAnalytics } from "@/lib/hooks/use-technician-analytics";
import { AnalyticsCard } from "@/components/maintenance-tickets/analytics/analytics-card";
import { EntityNotesAttachments } from "@/components/maintenance-tickets/entity-extras";
import { TechnicianFilters, useTechnicianFilters } from "@/components/maintenance-tickets/technicians/technician-filters";
import { TechnicianReport } from "@/components/maintenance-tickets/technicians/technician-report";
import { TechnicianProfileCard } from "@/components/maintenance-technicians/technician-profile-card";
import { TechnicianIssuesCovered } from "@/components/maintenance-technicians/technician-issues-covered";
import { TechnicianFormDialog } from "@/components/maintenance-technicians/technician-form-dialog";
import { TechnicianTripsList } from "@/components/maintenance-technicians/technician-trips-list";
import { PaymentsList } from "@/components/maintenance-technicians/payments-list";

const SKELETON_BLOCKS = 3;

/**
 * One technician (docs/MAINTENANCE-UI.md §7): the profile card, the issues
 * he covers (★ per issue, call first, notes), his latest trips and payments,
 * notes and files, then his work report for a range.
 */
export default function MaintenanceTechnicianPage() {
  const t = useTranslations("maintenanceSystem");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) ?? "en";
  const technicianId = Number(params?.technicianId) || null;
  const { canAccessRoute } = useAuth();
  const canEdit = canAccessRoute({ service: "Maintenance", method: "PATCH", path: "/technicians/placeholder" });
  const canEditCoverage = canAccessRoute({ service: "Maintenance", method: "PUT", path: "/technicians/placeholder/abilities/placeholder" });

  const { technician, isLoading, error, refresh, setData } = useTechnician(technicianId);
  const [editing, setEditing] = useState(false);

  const filters = useTechnicianFilters();
  const report = useTechnicianAnalytics(technicianId ?? 0);
  const { load } = report;
  const reloadReport = useCallback(() => {
    if (filters.params && technicianId) void load(filters.params);
  }, [filters.params, technicianId, load]);
  useEffect(() => {
    reloadReport();
  }, [reloadReport]);

  const listHref = `/${locale}/dashboard/maintenance-technicians`;

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label={t("technicians.loading")}>
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: SKELETON_BLOCKS }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
      </div>
    );
  }

  if (error || !technician) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("pages.technician")} />
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-sm text-sm text-muted-foreground">{error?.message ?? t("technicians.notFound")}</p>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link href={listHref}>{t("technicians.backToList")}</Link></Button>
            {error?.retryable && <Button onClick={() => void refresh()}>{t("common.retry")}</Button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={listHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {t("pages.technicians")}
        </Link>
      </div>
      <PageHeader title={technician.name} description={technician.category?.name ?? t("vocab.terms.technician.label")} />

      {technician.deletedAt && (
        <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {t("technicians.deletedBanner")}
        </p>
      )}

      <TechnicianProfileCard
        technician={technician}
        canEdit={canEdit}
        onEdit={() => setEditing(true)}
        onChanged={(next) => (next ? setData(next) : router.push(listHref))}
      />

      <TechnicianIssuesCovered
        technicianId={technician.id}
        issues={technician.coveredIssues ?? []}
        canEdit={canEditCoverage && !technician.deletedAt}
        onChanged={() => void refresh()}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsCard icon={Route} title={t("pages.trips")} description={t("technicians.tripsHelp")}>
          <TechnicianTripsList locale={locale} technicianId={technician.id} />
        </AnalyticsCard>
        <AnalyticsCard icon={Receipt} title={t("pages.payments")} description={t("technicians.paymentsHelp")}>
          <PaymentsList
            locale={locale}
            filters={{ technicianId: technician.id }}
            allHref={`/${locale}/dashboard/maintenance-payments?technician_id=${technician.id}`}
          />
        </AnalyticsCard>
      </div>

      <AnalyticsCard icon={HardHat} title={t("common.notes")} description={t("technicians.notesHelp")}>
        <EntityNotesAttachments
          entityPath={entityPaths.technician(technician.id)}
          notes={technician.notes ?? []}
          attachments={technician.attachments ?? []}
          onSuccess={() => void refresh()}
          canAdd={canEdit}
          alwaysOpen
        />
      </AnalyticsCard>

      <section aria-labelledby="work-report" className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 id="work-report" className="font-heading text-lg font-semibold">{t("technicians.workReport")}</h2>
        </div>
        <TechnicianFilters filters={filters} showCategory={false} isUpdating={report.isLoading && report.loadedParams !== null} />
        {!report.loadedParams ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
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
      </section>

      <TechnicianFormDialog
        open={editing}
        technician={technician}
        onOpenChange={setEditing}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
