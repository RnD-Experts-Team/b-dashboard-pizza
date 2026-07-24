"use client";

import { Fragment, useMemo, useState } from "react";
import { Cake } from "lucide-react";
import { cn } from "@/lib/utils";
import { StoreNav, type StoreNavItem } from "../store-nav";
import {
  ReportCard,
  Chip,
  TblWrap,
  TBL,
  TH,
  TD,
  NUM,
} from "@/components/wbr-reports/primitives";
import { fmt$2, fmtPct } from "@/lib/mock/business-reports.mock";
import type {
  V1ReportsResponse,
  V1StoreReport,
} from "@/types/business-reports.types";
import { TabEmpty, TabError } from "../states";
import { ExpandChevronButton, useExpandedRows } from "../expandable-row";
import { CATEGORIES as REPORT_COLORS } from "@/components/dashboard-v1/category";

const PEOPLE = REPORT_COLORS.people;
const SUB_LABEL = cn(
  "text-[11px] font-semibold uppercase tracking-wide",
  PEOPLE.headerText,
);

interface Props {
  data: V1ReportsResponse | null;
  error: string | null;
}

function laborChipTone(labor: number | null): "ok" | "warn" | "bad" | "muted" {
  if (labor === null) return "muted";
  if (labor <= 28) return "ok";
  if (labor <= 32) return "warn";
  return "bad";
}

function StoreLaborBlock({ storeNum, report }: { storeNum: string; report: V1StoreReport }) {
  const weekly = report["weekly-labor"]?.entries ?? [];
  const highHours = report["high-hours-employees"]?.employees ?? [];
  const avgPay = report["average-hourly-pay"]?.employees ?? [];
  const roster = report["manager-dashboard"]?.employees ?? [];
  const birthdays = roster.filter((e) => e.birthday?.is_upcoming);
  const rosterExpand = useExpandedRows();

  return (
    <ReportCard
      title={`Store ${storeNum}`}
      hint={`${roster.length} employees`}
      className="lg:col-span-2"
      bodyClassName="grid gap-4 p-4 lg:grid-cols-2"
      accent={PEOPLE}
    >
      {/* Employee roster (full manager-dashboard) */}
      <div className="space-y-2 lg:col-span-2">
        <p className={SUB_LABEL}>Employee Roster</p>
        {roster.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">No employees.</p>
        ) : (
          <TblWrap tall>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Employee</th>
                  <th className={TH}>Position</th>
                  <th className={cn(TH, NUM)}>Base Pay</th>
                  <th className={cn(TH, NUM)}>Perf Pay</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Birthday</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((e) => {
                  const metrics = e.metrics ?? [];
                  const open = rosterExpand.isExpanded(String(e.employee_id));
                  return (
                    <Fragment key={e.employee_id}>
                      <tr>
                        <td className={TD}>
                          <ExpandChevronButton
                            expanded={open}
                            onClick={() => rosterExpand.toggle(String(e.employee_id))}
                          />
                          {[e.name?.first, e.name?.middle, e.name?.last]
                            .filter(Boolean)
                            .join(" ")}
                        </td>
                        <td className={TD}>{e.position ?? "—"}</td>
                        <td className={cn(TD, NUM)}>
                          {e.base_pay ? fmt$2(Number(e.base_pay)) : "—"}
                        </td>
                        <td className={cn(TD, NUM)}>
                          {e.performance_pay ? fmt$2(Number(e.performance_pay)) : "—"}
                        </td>
                        <td className={TD}>
                          <Chip tone={e.status === "active" ? "ok" : "muted"}>
                            {e.status}
                          </Chip>
                        </td>
                        <td className={TD}>
                          {e.birthday?.is_upcoming ? (
                            <Chip tone="info">
                              <Cake className="h-3 w-3" />
                              {e.birthday.days_until}d · turns {e.birthday.turns_age}
                            </Chip>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={6} className="bg-muted/20 p-2">
                            {metrics.length === 0 ? (
                              <p className="p-2 text-xs text-muted-foreground">
                                No per-day metrics for this employee.
                              </p>
                            ) : (
                              <table className={TBL}>
                                <thead>
                                  <tr>
                                    <th className={TH}>Date</th>
                                    <th className={TH}>Metric</th>
                                    <th className={cn(TH, NUM)}>Value</th>
                                    <th className={cn(TH, NUM)}>Numeric</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {metrics.map((m, i) => (
                                    <tr key={`${m.metric_date}-${m.label}-${i}`}>
                                      <td className={TD}>{m.metric_date}</td>
                                      <td className={TD}>{m.label}</td>
                                      <td className={cn(TD, NUM)}>{m.value}</td>
                                      <td className={cn(TD, NUM)}>{m.value_numeric}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </TblWrap>
        )}
      </div>

      {/* Weekly labor */}
      <div className="space-y-2">
        <p className={SUB_LABEL}>Weekly Labor</p>
        <TblWrap>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Week</th>
                <th className={cn(TH, NUM)}>Labor %</th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((w) => (
                <tr key={w.week_start}>
                  <td className={TD}>
                    {w.week_start} → {w.week_end}
                  </td>
                  <td className={cn(TD, NUM)}>
                    <Chip tone={laborChipTone(w.labor)}>
                      {w.labor === null ? "—" : fmtPct(w.labor)}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TblWrap>
      </div>

      {/* Average hourly pay */}
      <div className="space-y-2">
        <p className={SUB_LABEL}>Hourly Pay &amp; Labor</p>
        <TblWrap>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Employee</th>
                <th className={cn(TH, NUM)}>Rate</th>
                <th className={cn(TH, NUM)}>Hours</th>
                <th className={cn(TH, NUM)}>Tips</th>
                <th className={cn(TH, NUM)}>Labor %</th>
              </tr>
            </thead>
            <tbody>
              {avgPay.map((e) => (
                <tr key={e.employee_id}>
                  <td className={TD}>
                    {e.first_name} {e.last_name}
                  </td>
                  <td className={cn(TD, NUM)}>
                    {e.hourly_pay === null ? "—" : fmt$2(e.hourly_pay)}
                  </td>
                  <td className={cn(TD, NUM)}>{e.total_hours ?? "—"}</td>
                  <td className={cn(TD, NUM)}>
                    {e.tips === null ? "—" : fmt$2(e.tips)}
                  </td>
                  <td className={cn(TD, NUM)}>
                    {e.labor === null ? "—" : fmtPct(e.labor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TblWrap>
      </div>

      {/* High-hours employees */}
      <div className="space-y-2">
        <p className={SUB_LABEL}>High-Hours Employees (60h+)</p>
        {highHours.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">None in range.</p>
        ) : (
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Employee</th>
                  <th className={TH}>Position</th>
                  <th className={cn(TH, NUM)}>Hours</th>
                  <th className={cn(TH, NUM)}>Hourly Pay</th>
                  <th className={cn(TH, NUM)}>Gross Pay</th>
                </tr>
              </thead>
              <tbody>
                {highHours.map((e) => (
                  <tr key={e.employee_id}>
                    <td className={TD}>
                      {e.first_name} {e.last_name}
                    </td>
                    <td className={TD}>{e.position ?? "—"}</td>
                    <td className={cn(TD, NUM)}>{e.total_hours ?? "—"}</td>
                    <td className={cn(TD, NUM)}>
                      {e.hourly_pay === null ? "—" : fmt$2(e.hourly_pay)}
                    </td>
                    <td className={cn(TD, NUM)}>
                      {e.gross_pay === null ? "—" : fmt$2(e.gross_pay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TblWrap>
        )}
      </div>

      {/* Upcoming birthdays */}
      <div className="space-y-2">
        <p className={SUB_LABEL}>Upcoming Birthdays</p>
        {birthdays.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">None upcoming.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {birthdays.map((e) => (
              <Chip key={e.employee_id} tone="info">
                <Cake className="h-3 w-3" />
                {e.name.first} {e.name.last}
                {e.birthday.is_upcoming && ` · ${e.birthday.days_until}d`}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </ReportCard>
  );
}

/** "03795-00001" → "1" for a compact pill label. */
function shortStore(id: string): string {
  const m = id.match(/(\d+)\s*$/);
  return m && m[1] ? String(parseInt(m[1], 10)) : id;
}

export function LaborTab({ data, error }: Props) {
  const [sel, setSel] = useState<string>("");

  const entries = useMemo(() => (data ? Object.entries(data) : []), [data]);
  const navItems: StoreNavItem[] = useMemo(
    () =>
      entries.map(([id, report]) => {
        const count = report["manager-dashboard"]?.employees?.length ?? 0;
        return {
          key: id,
          code: shortStore(id),
          label: `Store ${shortStore(id)} · ${id}`,
          muted: count === 0,
        };
      }),
    [entries],
  );

  if (error) return <TabError message={error} />;
  if (entries.length === 0)
    return <TabEmpty message="No labor data for the selected range." />;

  const keys = entries.map(([id]) => id);
  const effective =
    sel && (sel === "all" || keys.includes(sel)) ? sel : (keys[0] ?? "all");
  const shown =
    effective === "all"
      ? entries
      : entries.filter(([id]) => id === effective);

  return (
    <div className="flex flex-col gap-4 lg:flex-row-reverse lg:items-start">
      <StoreNav
        items={navItems}
        value={effective}
        onChange={setSel}
        className="lg:sticky lg:top-0"
      />
      <div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-2">
        {shown.map(([storeNum, report]) => (
          <StoreLaborBlock key={storeNum} storeNum={storeNum} report={report} />
        ))}
      </div>
    </div>
  );
}
