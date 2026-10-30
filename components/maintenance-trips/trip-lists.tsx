"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, RefreshCw, Route, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from "@/components/maintenance-tickets/form-bits";
import { useTechnicians } from "@/lib/hooks/use-maintenance-catalog";
import { useTrips } from "@/lib/hooks/use-maintenance-trips";
import {
  currentStop,
  formatMinutes,
  jobCounts,
  liveOpenSession,
  liveStops,
  minutesSince,
  officeTripState,
  stopPlace,
  todayLocal,
} from "@/lib/maintenance-trips";
import { cn } from "@/lib/utils";
import { formatDateOnly, formatDateOnlyWithWeekday, formatTimestamp } from "@/lib/utils/date-display";
import type { Trip, TripFilters } from "@/types/maintenance-v2";
import { LinkStatusBadge, TripStateBadge, TripStatusBadge } from "./trip-badges";

const LIVE_PAGE_SIZE = 50;
const HISTORY_PAGE_SIZE = 25;
const TECH_FILTER_PAGE_SIZE = 100;
const ON_CLOCK_REFRESH_MS = 60_000;
const ALL = "all";
const SKELETON_CARDS = 3;

/* ── Shared states ───────────────────────────────────────────────────────── */

function ListSkeleton({ rows = SKELETON_CARDS }: { rows?: number }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>
  );
}

function ListError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("maintenanceV2");
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <AlertCircle className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{t("common.loadError")}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw aria-hidden="true" />
        {t("common.retry")}
      </Button>
    </div>
  );
}

export function ListEmpty({ icon, text, action }: { icon: ReactNode; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
      <span className="text-muted-foreground [&_svg]:h-8 [&_svg]:w-8" aria-hidden="true">
        {icon}
      </span>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

/** Lists reload when the page says something changed (a write in the drawer, a new trip). */
function useReload(reload: number, refresh: () => Promise<void>): void {
  useEffect(() => {
    if (reload) void refresh();
    // refresh is stable per key; only the signal should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);
}

function placesOf(trip: Trip, other: string): string {
  const names = liveStops(trip).map((s) => {
    const p = stopPlace(s);
    return p.storeNumber ?? p.other ?? other;
  });
  return names.join(", ");
}

/* ── On the clock now ────────────────────────────────────────────────────── */

function OnClockCard({ trip, now, onOpen }: { trip: Trip; now: number; onOpen: (id: number) => void }) {
  const t = useTranslations("maintenanceV2");
  const session = liveOpenSession(trip);
  const stop = currentStop(trip);
  const place = stop ? stopPlace(stop) : null;
  return (
    <button
      type="button"
      onClick={() => onOpen(trip.id)}
      className="flex w-full flex-col gap-2 rounded-lg border bg-card p-3 text-start transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-heading text-base font-semibold">{trip.technician?.name}</span>
        <TripStateBadge state={officeTripState(trip)} />
      </div>
      {session && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {t("trips.since", { time: formatTimestamp(session.clockIn, "h:mm a") })}
          <span className="font-medium text-foreground">· {formatMinutes(minutesSince(session.clockIn, now))}</span>
        </p>
      )}
      <p className="flex items-center gap-1.5 text-xs">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        {place
          ? `${place.storeNumber ? t("trips.storeN", { number: place.storeNumber }) : place.other} · ${
              stop?.status === "arrived" ? t("trips.list.thereNow") : t("trips.list.nextStop")
            }`
          : t("trips.list.noStop")}
      </p>
    </button>
  );
}

export function OnClockList({ reload, onOpen }: { reload: number; onOpen: (id: number) => void }) {
  const t = useTranslations("maintenanceV2");
  const { trips, isLoading, error, refresh, isRefreshing } = useTrips({ onClock: true, status: "open", perPage: LIVE_PAGE_SIZE });
  const [now, setNow] = useState(() => Date.now());
  useReload(reload, refresh);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, ON_CLOCK_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (isLoading && !trips.length) return <ListSkeleton />;
  if (error && !trips.length) return <ListError onRetry={() => void refresh()} />;
  if (!trips.length) return <ListEmpty icon={<Clock />} text={t("trips.list.nobodyOnClock")} />;
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={isRefreshing}>
          <RefreshCw className={cn(isRefreshing && "animate-spin")} aria-hidden="true" />
          {t("common.refresh")}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((trip) => (
          <OnClockCard key={trip.id} trip={trip} now={now} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

/* ── Today & upcoming ────────────────────────────────────────────────────── */

function UpcomingRow({ trip, onOpen }: { trip: Trip; onOpen: (id: number) => void }) {
  const t = useTranslations("maintenanceV2");
  const jobs = jobCounts(trip);
  const places = placesOf(trip, t("common.otherStore"));
  return (
    <button
      type="button"
      onClick={() => onOpen(trip.id)}
      className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-card px-3 py-2.5 text-start text-sm transition-colors hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="font-medium">{trip.technician?.name}</span>
      {trip.onClock && <TripStateBadge state={officeTripState(trip)} />}
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {places ? t("trips.list.stores", { stores: places }) : t("trips.list.noStop")}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">{t("trips.drawer.jobsValue", { done: jobs.done, total: jobs.total })}</span>
      <LinkStatusBadge active={trip.link.active} />
    </button>
  );
}

export function UpcomingList({
  reload,
  onOpen,
  emptyAction,
}: {
  reload: number;
  onOpen: (id: number) => void;
  emptyAction: ReactNode;
}) {
  const t = useTranslations("maintenanceV2");
  const [today] = useState(todayLocal);
  const { trips, isLoading, error, refresh } = useTrips({ status: "open", from: today, perPage: LIVE_PAGE_SIZE });
  useReload(reload, refresh);

  if (isLoading && !trips.length) return <ListSkeleton />;
  if (error && !trips.length) return <ListError onRetry={() => void refresh()} />;
  if (!trips.length) return <ListEmpty icon={<CalendarDays />} text={t("trips.list.noUpcoming")} action={emptyAction} />;

  const days = Array.from(new Set(trips.map((tr) => tr.plannedDate))).sort();
  return (
    <div className="space-y-4">
      {days.map((day) => (
        <section key={day} className="space-y-1.5">
          <h3 className="font-heading text-sm font-semibold">
            {day === today ? t("trips.list.today") : formatDateOnlyWithWeekday(day)}
          </h3>
          <div className="space-y-1.5">
            {trips
              .filter((tr) => tr.plannedDate === day)
              .map((trip) => (
                <UpcomingRow key={trip.id} trip={trip} onOpen={onOpen} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ── History ─────────────────────────────────────────────────────────────── */

export interface HistoryFilters {
  technicianId: number | null;
  from: string;
  to: string;
  search: string;
}

export function HistoryList({
  reload,
  filters,
  onFilters,
  onOpen,
}: {
  reload: number;
  filters: HistoryFilters;
  onFilters: (next: HistoryFilters) => void;
  onOpen: (id: number) => void;
}) {
  const t = useTranslations("maintenanceV2");
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState(filters.search);
  const { technicians } = useTechnicians({ perPage: TECH_FILTER_PAGE_SIZE });
  const query: TripFilters = {
    technicianId: filters.technicianId ?? undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    search: filters.search || undefined,
    page,
    perPage: HISTORY_PAGE_SIZE,
  };
  const { trips, meta, isLoading, error, refresh } = useTrips(query);
  useReload(reload, refresh);

  function set(next: Partial<HistoryFilters>): void {
    setPage(1);
    onFilters({ ...filters, ...next });
  }

  const hasFilters = !!(filters.technicianId || filters.from || filters.to || filters.search);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <form
          className="relative min-w-48 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            set({ search: searchText.trim() });
          }}
        >
          <Label htmlFor="trip-history-search" className="sr-only">
            {t("common.search")}
          </Label>
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="trip-history-search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onBlur={() => searchText.trim() !== filters.search && set({ search: searchText.trim() })}
            placeholder={t("trips.list.searchPlaceholder")}
            className="h-8 ps-8 text-sm"
          />
        </form>
        <div className="w-48">
          <Label className="sr-only">{t("vocab.terms.technician.label")}</Label>
          <Select
            value={filters.technicianId ? String(filters.technicianId) : ALL}
            onValueChange={(v) => set({ technicianId: v === ALL ? null : Number(v) })}
          >
            <SelectTrigger className="h-8 w-full text-sm" aria-label={t("vocab.terms.technician.label")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("trips.list.allTechnicians")}</SelectItem>
              {technicians.map((tech) => (
                <SelectItem key={tech.id} value={String(tech.id)}>
                  {tech.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <DatePicker value={filters.from} onChange={(v) => set({ from: v })} placeholder={t("trips.list.from")} />
        </div>
        <div className="w-40">
          <DatePicker value={filters.to} onChange={(v) => set({ to: v })} placeholder={t("trips.list.to")} />
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchText("");
              set({ technicianId: null, from: "", to: "", search: "" });
            }}
          >
            {t("common.clearAll")}
          </Button>
        )}
      </div>

      {isLoading && !trips.length && <Skeleton className="h-64 w-full" />}
      {error && !trips.length && <ListError onRetry={() => void refresh()} />}
      {!isLoading && !error && !trips.length && <ListEmpty icon={<Route />} text={t("trips.list.noHistory")} />}

      {!!trips.length && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("vocab.terms.technician.label")}</TableHead>
                <TableHead>{t("common.stores")}</TableHead>
                <TableHead className="text-end">{t("trips.paidTime")}</TableHead>
                <TableHead className="text-end">{t("trips.drawer.jobs")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((trip) => {
                const jobs = jobCounts(trip);
                return (
                  <TableRow
                    key={trip.id}
                    className={cn("cursor-pointer", trip.mistaken && "opacity-60")}
                    tabIndex={0}
                    onClick={() => onOpen(trip.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(trip.id);
                      }
                    }}
                  >
                    <TableCell className="whitespace-nowrap tabular-nums">{formatDateOnly(trip.plannedDate)}</TableCell>
                    <TableCell className={cn("font-medium", trip.mistaken && "line-through")}>{trip.technician?.name}</TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">{placesOf(trip, t("common.otherStore")) || "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMinutes(trip.totals.paidMinutes)}</TableCell>
                    <TableCell className="text-end tabular-nums">{t("trips.drawer.jobsValue", { done: jobs.done, total: jobs.total })}</TableCell>
                    <TableCell>
                      <TripStatusBadge status={trip.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{t("trips.list.pageOf", { page: meta.currentPage, pages: meta.lastPage })}</span>
          <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={t("trips.list.previous")}>
            <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= meta.lastPage}
            onClick={() => setPage((p) => p + 1)}
            aria-label={t("trips.list.next")}
          >
            <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
