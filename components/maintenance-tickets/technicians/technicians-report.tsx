"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Banknote, Clock, HardHat, MapPin, Search, Star, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AnalyticsCard } from "@/components/maintenance-tickets/analytics/analytics-card";
import { AnalyticsBarChart } from "@/components/maintenance-tickets/analytics/analytics-bar-chart";
import { KpiTile } from "@/components/maintenance-tickets/analytics/analytics-kpis";
import { Empty, Pager, ReportTable, SectionError, TD, TH, usePaged } from "@/components/maintenance-tickets/analytics/analytics-sections";
import { formatDateOnly } from "@/lib/utils/date-display";
import { localDay } from "@/lib/maintenance-tickets/local-range";
import type { TechnicianHours, TechniciansOverview } from "@/types/technician-analytics.types";

/**
 * The latest day they worked: the later of their latest pay-sheet day and
 * their latest unpaid visit (in the viewer's clock), as "YYYY-MM-DD".
 */
export function lastWorkedDay(lastVisitAt: string | null, lastPayDate: string | null): string | null {
  const visitDay = lastVisitAt ? localDay(new Date(lastVisitAt)) : null;
  if (!visitDay) return lastPayDate;
  if (!lastPayDate) return visitDay;
  return visitDay > lastPayDate ? visitDay : lastPayDate;
}

/** Paid hours: work, travel and parts runs. Breaks are tracked, never paid. */
export function paidHours(h: TechnicianHours): number {
  return Math.round((h.work + h.travel + h.parts_run) * 100) / 100;
}

/** Hours worked stay hours ("126.5 h") -- a working day is not 24 of them. */
export function hoursText(h: number): string {
  return `${h.toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** "$1,840.50" -- pay arrives as decimal strings. */
export const money = (v: string | number) => {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? USD.format(n) : "—";
};
const moneyFormat = (v: number) => money(v);

/**
 * Every technician, with what they were paid and the work they did in the
 * range: the numbers, two charts, then the full list -- each row opens the
 * technician's own page.
 */
export function TechniciansReport({
  locale,
  data,
  error,
  rangeLabel,
}: {
  locale: string;
  data: TechniciansOverview | null;
  error: string | null;
  rangeLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.technicians ?? [])
      .filter((t) => showDeleted || !t.deleted_at)
      .filter((t) => !q || [t.name, t.category?.name ?? "", t.location ?? "", t.phone ?? ""].some((x) => x.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.paid) - Number(a.paid) || b.visits - a.visits || a.name.localeCompare(b.name));
  }, [data, query, showDeleted]);

  const pager = usePaged(rows, rows.length, 10);
  const active = (data?.technicians ?? []).filter((t) => !t.deleted_at);
  const totals = data?.totals;

  return (
    <div className="@container space-y-6">
      {error && <div className="rounded-xl border bg-card"><SectionError message={error} /></div>}

      {totals && (
        <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
          <KpiTile kpi={{
            label: "Paid",
            value: money(totals.paid),
            icon: Banknote,
            tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            note: data?.filtered_money ? `${rangeLabel} · those stores / issues` : `${rangeLabel} · from the pay sheets`,
          }} />
          <KpiTile kpi={{
            label: "Worked",
            value: totals.technicians_worked,
            icon: Users,
            tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
            note: `of ${active.length} technicians`,
          }} />
          <KpiTile kpi={{
            label: "Visits",
            value: totals.visits,
            icon: Wrench,
            tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            note: "Days on pay sheets + unpaid visits",
          }} />
          <KpiTile kpi={{
            label: "Hours",
            value: hoursText(paidHours(totals.hours)),
            icon: Clock,
            tint: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
            note: "Work, travel and parts runs",
          }} />
        </div>
      )}

      {data && (
        <div className="grid gap-6 @4xl:grid-cols-2">
          <AnalyticsCard center icon={Banknote} title="Paid by technician" description={`${rangeLabel}, from the daily pay sheets.`}>
            <AnalyticsBarChart
              title="Paid by technician"
              rows={active.filter((t) => Number(t.paid) !== 0).map((t) => ({ label: t.name, value: Number(t.paid) }))}
              valueLabel="paid"
              format={moneyFormat}
            />
          </AnalyticsCard>
          <AnalyticsCard center icon={BarChart3} title="Hours by technician" description="Work, travel and parts runs: pay sheets plus unpaid visits.">
            <AnalyticsBarChart
              title="Paid hours by technician"
              rows={active.filter((t) => paidHours(t.hours) > 0).map((t) => ({ label: t.name, value: paidHours(t.hours) }))}
              valueLabel="hours"
              format={hoursText}
            />
          </AnalyticsCard>
        </div>
      )}

      <ReportTable
        id="technicians"
        title="Technicians"
        count={rows.length}
        unit="technicians"
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>Most paid first. Open one to see their pay, work, ratings and coverage.</span>
            <span className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, category, location…" className="h-8 w-56 ps-8" aria-label="Find a technician" />
            </span>
            <span className="flex items-center gap-2">
              <Switch id="show-deleted-technicians" checked={showDeleted} onCheckedChange={setShowDeleted} />
              <Label htmlFor="show-deleted-technicians" className="text-sm font-normal">Show deleted</Label>
            </span>
          </span>
        }
      >
        {!data ? null : rows.length === 0 ? (
          <Empty>{query ? `No technician matches "${query}".` : "No technicians yet. Add the first one above."}</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th scope="col" className={TH}>Technician</th>
                <th scope="col" className={TH}>Coverage</th>
                <th scope="col" className={cn(TH, "text-end")}>Paid</th>
                <th scope="col" className={cn(TH, "text-end")}>Visits</th>
                <th scope="col" className={cn(TH, "text-end")}>Hours</th>
                <th scope="col" className={cn(TH, "text-end")}>Issues</th>
                <th scope="col" className={cn(TH, "text-end")}>Stores</th>
                <th scope="col" className={TH}>Last worked</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pager.rows.map((t) => (
                <tr key={t.id} className={cn("transition-colors hover:bg-muted/30", t.deleted_at && "opacity-60")}>
                  <td className={TD}>
                    <Link href={`/${locale}/dashboard/maintenance-technicians/${t.id}`} className="font-medium text-primary hover:underline">
                      {t.name}
                    </Link>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><HardHat className="h-3 w-3" aria-hidden="true" />{t.category?.name ?? "No category"}</span>
                      {t.rating != null && <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />{t.rating}</span>}
                      {t.deleted_at && <span>Deleted</span>}
                    </span>
                  </td>
                  <td className={cn(TD, "text-muted-foreground")}>
                    <span className="block">{t.coverage_count === 0 ? "No stores set" : `${t.coverage_count} ${t.coverage_count === 1 ? "store" : "stores"}`}</span>
                    {t.location && <span className="inline-flex items-center gap-1 text-xs"><MapPin className="h-3 w-3" aria-hidden="true" />{t.location}</span>}
                  </td>
                  <td className={cn(TD, "text-end font-semibold tabular-nums")}>{money(t.paid)}</td>
                  <td className={cn(TD, "text-end tabular-nums")}>{t.visits}</td>
                  <td className={cn(TD, "text-end tabular-nums")}>{paidHours(t.hours) > 0 ? hoursText(paidHours(t.hours)) : "—"}</td>
                  <td className={cn(TD, "text-end tabular-nums")}>{t.issues_worked}</td>
                  <td className={cn(TD, "text-end tabular-nums")}>{t.stores_served}</td>
                  <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>
                    {(() => {
                      const day = lastWorkedDay(t.last_worked_at, t.last_pay_date);
                      return day ? formatDateOnly(day, "MMM d, yyyy") : "—";
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager {...pager} onPage={pager.setPage} />
      </ReportTable>
    </div>
  );
}
