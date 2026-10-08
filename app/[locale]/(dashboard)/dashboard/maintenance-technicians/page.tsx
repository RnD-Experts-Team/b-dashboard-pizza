"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth/use-auth";
import { useTechniciansOverview } from "@/lib/hooks/use-technician-analytics";
import { formatDateOnly } from "@/lib/utils/date-display";
import { viewerTimeZone } from "@/lib/maintenance-tickets/local-range";
import { TechnicianFilters, useTechnicianFilters } from "@/components/maintenance-tickets/technicians/technician-filters";
import { TechniciansReport } from "@/components/maintenance-tickets/technicians/technicians-report";
import { TechnicianFormDialog } from "@/components/maintenance-tickets/technicians/technician-form-dialog";

/**
 * Technicians: every technician the MOS works with -- what each was paid
 * (from the daily pay sheets), the visits they made, the issues and stores
 * they worked -- for a range, stores, an issue and a trade. Each opens their
 * own page: profile, coverage, ratings, notes and their full report.
 */
export default function MaintenanceTechniciansPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const router = useRouter();
  const { canAccessRoute } = useAuth();
  const canAdd = canAccessRoute({ service: "Maintenance", method: "POST", path: "/technicians" });

  const filters = useTechnicianFilters();
  const { data, error, isLoading, loadedParams, load } = useTechniciansOverview();
  const [adding, setAdding] = useState(false);

  const reload = useCallback(() => {
    if (filters.params) void load(filters.params);
  }, [filters.params, load]);

  useEffect(() => {
    reload();
  }, [reload]);

  const days =
    filters.startDate === filters.endDate
      ? formatDateOnly(filters.startDate, "EEEE, MMMM d")
      : `${formatDateOnly(filters.startDate, "MMM d")} to ${formatDateOnly(filters.endDate, "MMM d, yyyy")}`;
  const zone = viewerTimeZone();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Technicians"
        description={`${filters.rangeLabel === "This range" ? "" : `${filters.rangeLabel}, `}${days}${zone ? ` · days in your time zone (${zone})` : ""}`}
      >
        <Button variant="outline" onClick={reload} disabled={isLoading}>
          <RefreshCw className={isLoading ? "me-2 h-4 w-4 animate-spin" : "me-2 h-4 w-4"} aria-hidden="true" />
          Refresh
        </Button>
        {canAdd && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="me-2 h-4 w-4" aria-hidden="true" />
            Add technician
          </Button>
        )}
      </PageHeader>

      <TechnicianFilters filters={filters} showTrade isUpdating={isLoading && loadedParams !== null} />

      {!loadedParams ? (
        <div className="space-y-6" aria-busy="true" aria-label="Loading the technicians">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <div className={isLoading ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"}>
          <TechniciansReport
            key={JSON.stringify(loadedParams)}
            locale={locale}
            data={data}
            error={error}
            rangeLabel={filters.rangeLabel}
          />
        </div>
      )}

      <TechnicianFormDialog
        open={adding}
        technician={null}
        onClose={() => setAdding(false)}
        onSaved={(t) => router.push(`/${locale}/dashboard/maintenance-technicians/${t.id}`)}
      />
    </div>
  );
}
