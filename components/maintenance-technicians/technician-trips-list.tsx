"use client";

import Link from "next/link";
import { AlertCircle, Route } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTrips } from "@/lib/hooks/use-maintenance-trips";
import { formatMinutes } from "@/lib/maintenance/money";
import { TRIP_STATUSES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import { formatDateOnly } from "@/lib/utils/date-display";

/** The newest trips shown here; the Trips page has the rest. */
const RECENT_TRIPS = 10;
const SKELETON_ROWS = 3;

/** The Trips page opened on one trip (its drawer). */
export function tripHref(locale: string, tripId: number): string {
  return `/${locale}/dashboard/maintenance-trips?trip=${tripId}`;
}

/**
 * The technician's latest trips: the day, the stores, paid time, and whether
 * he is on the clock or the trip is closed. A row opens the trip.
 */
export function TechnicianTripsList({ locale, technicianId }: { locale: string; technicianId: number }) {
  const t = useTranslations("maintenanceSystem");
  const { data, isLoading, error, refresh } = useTrips({ technicianId, perPage: RECENT_TRIPS });
  const trips = data?.data ?? [];
  const total = data?.meta.total ?? trips.length;

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
  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
        <Route className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("technicians.noTrips")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-lg border">
        {trips.map((trip) => {
          const stores = (trip.stops ?? []).map((s) => s.store?.storeNumber ?? s.otherStore).filter(Boolean);
          const status = trip.onClock ? t("vocab.tripState.on_clock.label") : vocabText(t, vocabEntry(TRIP_STATUSES, trip.status));
          return (
            <li key={trip.id}>
              <Link
                href={tripHref(locale, trip.id)}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{formatDateOnly(trip.plannedDate, "EEE, MMM d, yyyy")}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {stores.length ? stores.join(", ") : t("technicians.noStops")}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs tabular-nums text-muted-foreground">{formatMinutes(trip.totals?.paidMinutes)}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      trip.onClock
                        ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {status}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {total > trips.length && (
        <Link href={`/${locale}/dashboard/maintenance-trips?tab=history&tech=${technicianId}`} className="block text-end text-xs font-medium text-primary hover:underline">
          {t("technicians.allTrips", { count: total })}
        </Link>
      )}
    </div>
  );
}
