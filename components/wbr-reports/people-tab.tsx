"use client";

import {
  fmt$,
  HIRING_EXPENSE,
  type WbrData,
} from "@/lib/mock/wbr-reports.mock";
import {
  ReportCard,
  Chip,
  StoreCell,
  DataBar,
  TblWrap,
  TBL,
  TH,
  TD,
  NUM,
} from "./primitives";
import { cn } from "@/lib/utils";

const fmt2 = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ScoreChip({ n }: { n: number }) {
  return <Chip tone={n >= 4 ? "ok" : n === 3 ? "warn" : "bad"}>{n}/5</Chip>;
}

export function PeopleTab({ data }: { data: WbrData }) {
  const { rows, totals } = data;
  const h = totals.hiring;
  const maxLabor = Math.max(1, ...rows.map((r) => r.laborPct));

  const owed = rows.flatMap((r) => r.moneyOwed.map((m) => ({ store: r.store, ...m })));
  const owedTotal = owed.reduce((a, m) => a + m.amount, 0);
  const feedback = rows.flatMap((r) => r.feedback.map((f) => ({ store: r.store, ...f })));
  const employees = rows.flatMap((r) => r.over60List.map((e) => ({ store: r.store, ...e })));

  const rowTotals = HIRING_EXPENSE.rows.map((r) => r.values.reduce((a, b) => a + b, 0));
  const grand = rowTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* Hiring funnel */}
        <ReportCard title="Hiring funnel" hint={`${h.tours} tours · ${h.hired} hired · ${h.started} started`}>
          <div className="grid grid-cols-3 gap-2 p-4">
            {[
              ["Tours", h.tours],
              ["Hired", h.hired],
              ["Started", h.started],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="font-heading text-2xl font-semibold tabular-nums">{val}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Store</th>
                  <th className={cn(TH, NUM)}>Tours</th>
                  <th className={cn(TH, NUM)}>Hired</th>
                  <th className={cn(TH, NUM)}>Started</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.store.id}>
                    <td className={TD}>
                      <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                    </td>
                    <td className={cn(TD, NUM)}>{r.hiring.tours}</td>
                    <td className={cn(TD, NUM)}>{r.hiring.hired}</td>
                    <td className={cn(TD, NUM)}>{r.hiring.started}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TblWrap>
        </ReportCard>

        {/* Overtime */}
        <ReportCard title="Overtime (>60h)" hint="est. impact = headcount × $1,450">
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Store</th>
                  <th className={cn(TH, NUM)}>Employees &gt;60h</th>
                  <th className={cn(TH, NUM)}>Est. gross impact</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.store.id}>
                    <td className={TD}>
                      <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                    </td>
                    <td className={cn(TD, NUM)}>
                      {r.over60 > 0 ? <Chip tone="bad">{r.over60}</Chip> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className={cn(TD, NUM)}>{r.over60 > 0 ? fmt$(r.over60 * 1450) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TblWrap>
          {employees.length > 0 && (
            <div className="border-t">
              <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Employees over 60h — {employees.length} flagged · red &gt;70h
              </p>
              <TblWrap>
                <table className={TBL}>
                  <thead>
                    <tr>
                      <th className={TH}>Store</th>
                      <th className={TH}>Name</th>
                      <th className={TH}>Position</th>
                      <th className={cn(TH, NUM)}>Hours</th>
                      <th className={cn(TH, NUM)}>Hourly</th>
                      <th className={cn(TH, NUM)}>Gross pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((e, i) => (
                      <tr key={i}>
                        <td className={cn(TD, "font-semibold")}>{e.store.name}</td>
                        <td className={TD}>{e.name}</td>
                        <td className={cn(TD, "text-[10px] text-muted-foreground")}>{e.position}</td>
                        <td className={cn(TD, NUM, e.hours > 70 && "font-semibold text-red-600 dark:text-red-400")}>{e.hours.toFixed(1)}</td>
                        <td className={cn(TD, NUM)}>${e.hourlyPay.toFixed(2)}</td>
                        <td className={cn(TD, NUM)}>{fmt2(e.grossPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TblWrap>
            </div>
          )}
        </ReportCard>
      </div>

      {/* Labor summary (bar list) */}
      <ReportCard title="Labor summary" hint="labor % by store · target 25%">
        <div className="flex flex-col gap-2 p-4">
          {rows.map((r) => (
            <div key={r.store.id} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-[12.5px] font-medium">{r.store.name}</span>
              <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    r.laborPct > 27 ? "bg-red-500" : r.laborPct < 22 ? "bg-emerald-500" : "bg-primary/70"
                  )}
                  style={{ width: `${(r.laborPct / maxLabor) * 100}%` }}
                />
                <span
                  className="absolute inset-y-0 w-px bg-foreground/40"
                  style={{ left: `${Math.min(100, (25 / maxLabor) * 100)}%` }}
                />
              </span>
              <span className="w-12 shrink-0 text-end text-[12.5px] tabular-nums">{r.laborPct.toFixed(1)}%</span>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Vertical line marks the 25% labor target.</p>
        </div>
      </ReportCard>

      {/* Hiring expense by platform */}
      <ReportCard title="Hiring expense by platform" hint="2026 YTD · monthly spend per company">
        <TblWrap>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Company</th>
                {HIRING_EXPENSE.months.map((m) => (
                  <th key={m} className={cn(TH, NUM)}>{m}</th>
                ))}
                <th className={cn(TH, NUM)}>Total</th>
                <th className={cn(TH, NUM)}>% of total</th>
              </tr>
            </thead>
            <tbody>
              {HIRING_EXPENSE.rows.map((r, i) => (
                <tr key={r.company}>
                  <td className={cn(TD, "font-semibold")}>{r.company}</td>
                  {r.values.map((v, j) => (
                    <td key={j} className={cn(TD, NUM)}>
                      {v ? fmt2(v) : <span className="text-muted-foreground">—</span>}
                    </td>
                  ))}
                  <td className={cn(TD, NUM, "font-semibold")}>{fmt2(rowTotals[i])}</td>
                  <td className={cn(TD, NUM)}>{((rowTotals[i] / grand) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40 font-semibold">
                <td className={TD}>Total</td>
                {HIRING_EXPENSE.months.map((_, mi) => (
                  <td key={mi} className={cn(TD, NUM)}>
                    {fmt2(HIRING_EXPENSE.rows.reduce((a, r) => a + r.values[mi], 0))}
                  </td>
                ))}
                <td className={cn(TD, NUM)}>{fmt2(grand)}</td>
                <td className={cn(TD, NUM)}>100%</td>
              </tr>
            </tfoot>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Money owed + feedback */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ReportCard title="Money owed" hint="SM out-of-pocket reimbursements">
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Store</th>
                  <th className={TH}>SM</th>
                  <th className={TH}>Expense</th>
                  <th className={cn(TH, NUM)}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {owed.length ? (
                  owed.map((m, i) => (
                    <tr key={i}>
                      <td className={cn(TD, "font-semibold")}>{m.store.name}</td>
                      <td className={TD}>{m.smName}</td>
                      <td className={TD}>{m.desc}</td>
                      <td className={cn(TD, NUM)}>${m.amount.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className={cn(TD, "text-muted-foreground")} colSpan={4}>Nothing owed this week.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/40 font-semibold">
                  <td className={TD} colSpan={3}>Grand Total</td>
                  <td className={cn(TD, NUM)}>${owedTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </TblWrap>
          <p className="px-4 py-2 text-[11px] text-muted-foreground">approved by Dan Scott (GM)</p>
        </ReportCard>

        <ReportCard title="Employee feedback" hint="feel respected / schedule works · 1–5">
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Employee</th>
                  <th className={TH}>Suggestion</th>
                  <th className={TH}>Respected</th>
                  <th className={TH}>Schedule</th>
                </tr>
              </thead>
              <tbody>
                {feedback.length ? (
                  feedback.map((f, i) => (
                    <tr key={i}>
                      <td className={TD}>
                        <span className="font-semibold">{f.name}</span>
                        <span className="ms-1 text-[10px] text-muted-foreground">{f.store.name}</span>
                      </td>
                      <td className={cn(TD, "max-w-[280px] whitespace-normal")}>{f.suggestion}</td>
                      <td className={TD}><ScoreChip n={f.respected} /></td>
                      <td className={TD}><ScoreChip n={f.schedule} /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className={cn(TD, "text-muted-foreground")} colSpan={4}>No feedback submitted this week.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TblWrap>
        </ReportCard>
      </div>
    </div>
  );
}
