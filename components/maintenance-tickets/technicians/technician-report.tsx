"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Banknote, CalendarCheck, Clock, Hourglass, Layers, Route, Store as StoreIcon, Wallet, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/utils/date-display";
import { AnalyticsCard } from "@/components/maintenance-tickets/analytics/analytics-card";
import { AnalyticsBarChart } from "@/components/maintenance-tickets/analytics/analytics-bar-chart";
import { KpiTile } from "@/components/maintenance-tickets/analytics/analytics-kpis";
import { Empty, Pager, ReportTable, SectionError, TD, TH, usePaged } from "@/components/maintenance-tickets/analytics/analytics-sections";
import { LocalTimestamp } from "@/components/maintenance-tickets/local-timestamp";
import { hoursText, lastWorkedDay, money, paidHours } from "./technicians-report";
import { PAYMENT_LINE_TYPES, vocabHelp, vocabOptions, vocabText } from "@/lib/maintenance/vocabulary";
import type { TechnicianAnalytics, TechnicianPaidByStore, TechnicianPaySheet, TechnicianWorkVisit } from "@/types/technician-analytics.types";

/** The kinds of pay, in the order of the payment line types (the report sends every one). */
const KINDS = vocabOptions(PAYMENT_LINE_TYPES);

/** Where a line of pay went: a store, a storage location (parts for the shelf), or a store outside the list. */
function paidWhere(r: TechnicianPaidByStore): string {
  if (r.payment_level) return "Not tied to a store";
  if (r.store_number) return r.store_number;
  if (r.storage_location) return `Storage · ${r.storage_location.name}`;
  return r.other_store ?? "Other location";
}

const paidWhereKey = (r: TechnicianPaidByStore) =>
  `${r.store_id ?? ""}:${r.storage_location?.id ?? ""}:${r.other_store ?? ""}:${r.payment_level ? "p" : ""}`;

/** The payment, or the old pay sheet, a row of pay is. */
const paymentIdOf = (s: TechnicianPaySheet) => s.payment_id ?? s.daily_pay_payment_id ?? null;

/** The trip a clocked session was on; older work rows have none. */
const tripOf = (v: TechnicianWorkVisit) => v.trip_id ?? null;

const moneyFormat = (v: number) => money(v);
const visitsFormat = (v: number) => `${v} ${v === 1 ? "visit" : "visits"}`;

/**
 * One technician's report for the range: the numbers, two charts, then the
 * tables -- money (by kind, by store, the payments) before work (by issue,
 * by store, every visit).
 */
export function TechnicianReport({
  locale,
  technicianId,
  data,
  error,
  rangeLabel,
}: {
  locale: string;
  technicianId: number;
  data: TechnicianAnalytics | null;
  error: string | null;
  rangeLabel: string;
}) {
  const tv = useTranslations("maintenanceSystem");
  const sheets = usePaged(data?.pay_sheets ?? []);
  const work = usePaged(data?.work_log ?? [], undefined, 8);
  const byIssue = usePaged(data?.work_by_issue ?? []);

  if (error) return <div className="rounded-xl border bg-card"><SectionError message={error} /></div>;
  if (!data) return null;

  const k = data.kpis;
  const filtered = data.filtered_money;
  const kindsTotal = Object.values(data.paid_by_kind).reduce((sum, v) => sum + Number(v), 0);

  return (
    <div className="@container space-y-6">
      <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-3 @5xl:grid-cols-6">
        <KpiTile kpi={{ label: "Paid", value: money(k.paid), icon: Banknote, tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", note: filtered ? `${rangeLabel} · those stores / issues` : `${rangeLabel} · ${k.pay_days} payment ${k.pay_days === 1 ? "day" : "days"}`, target: "paid-by-kind" }} />
        <KpiTile kpi={{ label: "Paid all time", value: money(k.paid_all_time), icon: Wallet, tint: "bg-teal-500/10 text-teal-600 dark:text-teal-400", note: "Every payment so far" }} />
        <KpiTile kpi={{ label: "Sessions", value: k.visits, icon: Wrench, tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400", note: (() => { const day = lastWorkedDay(k.last_worked_at, k.last_pay_date); return day ? `Last ${formatDateOnly(day, "MMM d")}` : rangeLabel; })(), target: "work" }} />
        <KpiTile kpi={{ label: "Hours", value: hoursText(paidHours(k.hours)), icon: Clock, tint: "bg-purple-500/10 text-purple-600 dark:text-purple-400", note: `+ ${hoursText(k.hours.break)} break, unpaid` }} />
        <KpiTile kpi={{ label: "Issues", value: k.issues_worked, icon: Layers, tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400", note: `Worked · ${k.issues_assigned} assigned`, target: "work-by-issue" }} />
        <KpiTile kpi={{ label: "Stores", value: k.stores_served, icon: StoreIcon, tint: "bg-red-500/10 text-red-600 dark:text-red-400", note: k.parts_bought > 0 ? `Bought ${k.parts_bought} parts · ${money(k.parts_bought_amount)}` : "Worked at", target: "work-by-store" }} />
      </div>

      <div className="grid gap-6 @4xl:grid-cols-2">
        <AnalyticsCard center icon={Banknote} title="Paid by store" description={`${rangeLabel}, from the payments.`}>
          <AnalyticsBarChart
            title="Paid by store"
            rows={data.paid_by_store.map((r) => ({ label: paidWhere(r), value: Number(r.amount) }))}
            valueLabel="paid"
            format={moneyFormat}
          />
        </AnalyticsCard>
        <AnalyticsCard center icon={Wrench} title="Sessions by issue" description="What they were called out for.">
          <AnalyticsBarChart
            title="Sessions by issue"
            rows={data.work_by_issue.map((r) => ({ label: r.title, value: r.visits }))}
            valueLabel="visits"
            format={visitsFormat}
          />
        </AnalyticsCard>
      </div>

      <div className="grid gap-6 @4xl:grid-cols-2">
        <ReportTable id="paid-by-kind" title="Paid by type" description={filtered ? "Only the payment lines for the chosen stores or issues." : "Adds up to what they were paid."}>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {KINDS.map((kind) => (
                <tr key={kind.value}>
                  <td className={TD}>
                    <span className="font-medium">{vocabText(tv, kind)}</span>
                    <span className="block text-xs text-muted-foreground">{vocabHelp(tv, kind)}</span>
                  </td>
                  <td className={cn(TD, "text-end tabular-nums", Number(data.paid_by_kind[kind.value] ?? 0) === 0 && "text-muted-foreground")}>
                    {money(data.paid_by_kind[kind.value] ?? 0)}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/30">
                <td className={cn(TD, "font-semibold")}>Total</td>
                <td className={cn(TD, "text-end font-semibold tabular-nums")}>{money(kindsTotal)}</td>
              </tr>
            </tbody>
          </table>
        </ReportTable>

        <ReportTable id="paid-by-store" title="Paid by store" count={data.paid_by_store.filter((r) => !r.payment_level).length} unit="places" description="Each payment line belongs to one store, or to storage for parts bought for the shelf.">
          {data.paid_by_store.length === 0 ? (
            <Empty>No payments in this range.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th scope="col" className={TH}>Store</th>
                  <th scope="col" className={cn(TH, "text-end")}>Payment lines</th>
                  <th scope="col" className={cn(TH, "text-end")}>Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.paid_by_store.map((r) => (
                  <tr key={paidWhereKey(r)}>
                    <td className={TD}>
                      <span className="font-medium">{paidWhere(r)}</span>
                    </td>
                    <td className={cn(TD, "text-end tabular-nums text-muted-foreground")}>{r.payment_level ? "—" : r.lines}</td>
                    <td className={cn(TD, "text-end font-semibold tabular-nums")}>{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ReportTable>
      </div>

      <ReportTable id="pay-sheets" title={`Payments · ${rangeLabel}`} count={data.pay_sheets.length} unit="payments" description="Open one to see it on the Payments page.">
        {data.pay_sheets.length === 0 ? (
          <Empty>No payments to them in this range.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th scope="col" className={TH}>Day</th>
                <th scope="col" className={TH}>Stores</th>
                <th scope="col" className={cn(TH, "text-end")}>{filtered ? "Paid (those stores / issues)" : "Paid"}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sheets.rows.map((s) => (
                <tr key={paymentIdOf(s) ?? s.date} className="transition-colors hover:bg-muted/30">
                  <td className={TD}>
                    <Link
                      href={
                        s.payment_id
                          ? `/${locale}/dashboard/maintenance-payments?payment=${s.payment_id}`
                          : `/${locale}/dashboard/maintenance-payments?technician_id=${technicianId}&from=${s.date}&to=${s.date}`
                      }
                      className="font-medium text-primary hover:underline"
                    >
                      {formatDateOnly(s.date, "EEE, MMM d, yyyy")}
                    </Link>
                  </td>
                  <td className={cn(TD, "text-muted-foreground")}>{s.stores.length ? s.stores.join(", ") : "—"}</td>
                  <td className={cn(TD, "text-end font-semibold tabular-nums")}>{money(s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager {...sheets} onPage={sheets.setPage} />
      </ReportTable>

      <div className="grid gap-6 @4xl:grid-cols-2">
        <ReportTable id="work-by-issue" title="Work by issue" count={data.work_by_issue.length} unit="issues" description="A session that covered several issues counts toward each.">
          {data.work_by_issue.length === 0 ? (
            <Empty>No visits in this range.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th scope="col" className={TH}>Issue</th>
                  <th scope="col" className={cn(TH, "text-end")}>Sessions</th>
                  <th scope="col" className={cn(TH, "text-end")}>Tickets</th>
                  <th scope="col" className={cn(TH, "text-end")}>Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byIssue.rows.map((r) => (
                  <tr key={r.issue_id ?? "other"}>
                    <td className={cn(TD, "font-medium")}>{r.title}</td>
                    <td className={cn(TD, "text-end tabular-nums")}>{r.visits}</td>
                    <td className={cn(TD, "text-end tabular-nums")}>{r.tickets}</td>
                    <td className={cn(TD, "text-end tabular-nums")}>{hoursText(r.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pager {...byIssue} onPage={byIssue.setPage} />
        </ReportTable>

        <ReportTable id="work-by-store" title="Work by store" count={data.work_by_store.length} unit="stores" description="Where they worked.">
          {data.work_by_store.length === 0 ? (
            <Empty>No visits in this range.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th scope="col" className={TH}>Store</th>
                  <th scope="col" className={cn(TH, "text-end")}>Sessions</th>
                  <th scope="col" className={cn(TH, "text-end")}>Issues</th>
                  <th scope="col" className={cn(TH, "text-end")}>Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.work_by_store.map((r) => (
                  <tr key={r.store}>
                    <td className={cn(TD, "font-medium")}>{r.store}</td>
                    <td className={cn(TD, "text-end tabular-nums")}>{r.visits}</td>
                    <td className={cn(TD, "text-end tabular-nums")}>{r.issues}</td>
                    <td className={cn(TD, "text-end tabular-nums")}>{hoursText(r.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ReportTable>
      </div>

      <ReportTable
        id="work"
        title={`Work · ${rangeLabel}`}
        count={data.work_log.length}
        unit="sessions"
        description="Newest first: every clock-in to clock-out on a trip. Hours are work, travel and parts runs; breaks are not paid."
      >
        {data.work_log.length === 0 ? (
          <Empty>No work in this range.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th scope="col" className={TH}>When</th>
                <th scope="col" className={TH}>Store</th>
                <th scope="col" className={TH}>Tickets</th>
                <th scope="col" className={cn(TH, "text-end")}>Hours</th>
                <th scope="col" className={TH}>Trip</th>
                <th scope="col" className={TH}>Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {work.rows.map((v) => (
                <tr key={`${v.source}:${v.trip_session_id ?? v.attendance_entry_id ?? ""}:${v.daily_pay_entry_id ?? ""}:${v.stores.join(",")}`} className="transition-colors hover:bg-muted/30">
                  <td className={cn(TD, "whitespace-nowrap")}>
                    {v.source !== "pay_sheet" && v.start ? (
                      <LocalTimestamp iso={v.start} pattern="MMM d · h:mm a" showZone={false} />
                    ) : v.date ? (
                      formatDateOnly(v.date, "EEE, MMM d")
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={cn(TD, "whitespace-nowrap")}>{v.stores.join(", ") || "—"}</td>
                  <td className={TD}>
                    <span className="flex flex-col gap-0.5">
                      {v.tickets.map((t) => (
                        <span key={`${t.ticket_id}:${t.title}`}>
                          <Link
                            href={`/${locale}/dashboard/maintenance-tickets/${t.ticket_id}${t.store_number ? `?store=${encodeURIComponent(t.store_number)}` : ""}`}
                            className="font-medium text-primary hover:underline"
                          >
                            #{t.ticket_id}
                          </Link>{" "}
                          <span className="text-muted-foreground">{t.title}</span>
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className={cn(TD, "text-end tabular-nums")}>
                    {hoursText(paidHours(v.hours))}
                    {v.hours.break > 0 && <span className="block text-xs text-muted-foreground">+ {hoursText(v.hours.break)} break</span>}
                  </td>
                  <td className={TD}>
                    {tripOf(v) ? (
                      <Link href={`/${locale}/dashboard/maintenance-trips?trip=${tripOf(v)}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                        <Route className="h-3 w-3" aria-hidden="true" />
                        #{tripOf(v)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={TD}>
                    {v.paid ? (
                      <Link
                        href={`/${locale}/dashboard/maintenance-payments?technician_id=${technicianId}`}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        <CalendarCheck className="h-3 w-3" aria-hidden="true" />
                        Paid
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <Hourglass className="h-3 w-3" aria-hidden="true" />
                        Not paid yet
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager {...work} onPage={work.setPage} />
      </ReportTable>
    </div>
  );
}
