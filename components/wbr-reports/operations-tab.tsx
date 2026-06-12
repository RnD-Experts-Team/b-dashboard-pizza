"use client";

import {
  fmt$,
  fmtPct,
  transfers,
  type WbrData,
} from "@/lib/mock/wbr-reports.mock";
import {
  ReportCard,
  Chip,
  StoreCell,
  TblWrap,
  heat,
  TBL,
  TH,
  TD,
  NUM,
} from "./primitives";
import { cn } from "@/lib/utils";

const mins = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;

export function OperationsTab({ data }: { data: WbrData }) {
  const { rows } = data;
  const tx = transfers(data.week.id);
  const txTotal = tx.reduce((a, t) => a + t.cost, 0);

  return (
    <div className="grid gap-4">
      {/* Hours compliance */}
      <ReportCard title="Hours Compliance" hint="scheduled hours vs sales-driven range">
        <TblWrap>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
                <th className={cn(TH, NUM)}>Range</th>
                <th className={cn(TH, NUM)}>Hours</th>
                <th className={TH}>Diff</th>
                <th className={cn(TH, NUM)}>Pay</th>
                <th className={cn(TH, NUM)}>Labor %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const [lo, hi] = r.hoursRange;
                const diff =
                  r.hours > hi ? (
                    <Chip tone="bad">+{r.hours - hi} over</Chip>
                  ) : r.hours < lo ? (
                    <Chip tone="warn">−{lo - r.hours} under</Chip>
                  ) : (
                    <Chip tone="ok">In range</Chip>
                  );
                const lp = r.laborPct;
                const style = lp > 27 ? heat("red", 16) : lp < 22 ? heat("green", 14) : undefined;
                return (
                  <tr key={r.store.id}>
                    <td className={TD}>
                      <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                    </td>
                    <td className={cn(TD, NUM, "text-muted-foreground")}>{lo}–{hi}</td>
                    <td className={cn(TD, NUM, "font-semibold")}>{r.hours}</td>
                    <td className={TD}>{diff}</td>
                    <td className={cn(TD, NUM)}>{fmt$(r.pay)}</td>
                    <td className={cn(TD, NUM)} style={style}>{fmtPct(lp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Deposits */}
      <ReportCard title="Deposits" hint="physical vs bank reconciliation · variance in parentheses if short">
        <TblWrap tall={rows.length > 9}>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
                <th className={cn(TH, NUM)}>Physical</th>
                <th className={cn(TH, NUM)}>Cash Tips</th>
                <th className={cn(TH, NUM)}>Cash Sales</th>
                <th className={cn(TH, NUM)}>Cash Drop</th>
                <th className={cn(TH, NUM)}>Bank</th>
                <th className={cn(TH, NUM)}>Variance</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = r.deposit.variance;
                const txt = v < 0 ? `($${Math.abs(v).toFixed(2)})` : `$${v.toFixed(2)}`;
                return (
                  <tr key={r.store.id}>
                    <td className={TD}>
                      <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                    </td>
                    <td className={cn(TD, NUM)}>{fmt$(r.deposit.physical)}</td>
                    <td className={cn(TD, NUM)}>${r.deposit.cashTips.toFixed(2)}</td>
                    <td className={cn(TD, NUM)}>{fmt$(r.deposit.cashSales)}</td>
                    <td className={cn(TD, NUM)}>{fmt$(r.deposit.cashDrop)}</td>
                    <td className={cn(TD, NUM)}>{fmt$(r.deposit.bank)}</td>
                    <td className={cn(TD, NUM, v < 0 && "font-semibold text-red-600 dark:text-red-400")}>{txt}</td>
                    <td className={TD}>{v < -20 ? <Chip tone="bad">Short</Chip> : <Chip tone="ok">OK</Chip>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Non-negotiables + projected hours */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ReportCard title="Non-negotiables" hint="downtime & overtime exposure">
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Store</th>
                  <th className={cn(TH, NUM)}>Downtime</th>
                  <th className={TH}>Severity</th>
                  <th className={cn(TH, NUM)}>Over 60h</th>
                  <th className={TH}>Events</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const m = r.downtimeMin;
                  const sev =
                    m === 0 ? <Chip tone="muted">None</Chip> : m > 60 ? <Chip tone="bad">Critical</Chip> : <Chip tone="warn">Minor</Chip>;
                  return (
                    <tr key={r.store.id}>
                      <td className={TD}>
                        <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                      </td>
                      <td className={cn(TD, NUM)}>{m ? mins(m) : "—"}</td>
                      <td className={TD}>{sev}</td>
                      <td className={cn(TD, NUM)}>
                        {r.over60 > 0 ? <Chip tone="bad">{r.over60}</Chip> : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className={cn(TD, "whitespace-normal")}>
                        {r.downtimeEvents.length ? (
                          <details className="group">
                            <summary className="cursor-pointer list-none text-[11px] text-muted-foreground hover:text-foreground">
                              ▸ {r.downtimeEvents.length} event{r.downtimeEvents.length > 1 ? "s" : ""}
                            </summary>
                            <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[11px] text-muted-foreground">
                              {r.downtimeEvents.map((e, i) => (
                                <li key={i}>
                                  disabled {e.disabled} · {mins(e.minutes)} ·{" "}
                                  {e.note === "Didn't fill the form" ? (
                                    <em className="text-red-600 dark:text-red-400">{e.note}</em>
                                  ) : (
                                    e.note
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TblWrap>
        </ReportCard>

        <ReportCard title={`Projected hours — Week ${data.week.num + 2}`} hint="sales-driven ranges · OT red >50h">
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Store</th>
                  <th className={cn(TH, NUM)}>Hours range</th>
                  <th className={cn(TH, NUM)}>Projected sales</th>
                  <th className={cn(TH, NUM)}>OT projection</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.store.id}>
                    <td className={TD}>
                      <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                    </td>
                    <td className={cn(TD, NUM)}>{r.projected.range[0]}–{r.projected.range[1]}</td>
                    <td className={cn(TD, NUM)}>{fmt$(r.projected.sales)}</td>
                    <td className={cn(TD, NUM, r.projected.otHours > 50 && "font-semibold text-red-600 dark:text-red-400")}>
                      {r.projected.otHours}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TblWrap>
        </ReportCard>
      </div>

      {/* Transfers */}
      <ReportCard title="Transfers in / out" hint="network-wide · not affected by store filter">
        <TblWrap>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Date</th>
                <th className={TH}>From → To</th>
                <th className={TH}>Item</th>
                <th className={cn(TH, NUM)}>Qty</th>
                <th className={TH}>Unit</th>
                <th className={cn(TH, NUM)}>Cost $</th>
              </tr>
            </thead>
            <tbody>
              {tx.map((t, i) => (
                <tr key={i}>
                  <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>{t.date}</td>
                  <td className={TD}>
                    <span className="font-semibold">{t.from.name}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-semibold">{t.to.name}</span>
                  </td>
                  <td className={TD}>{t.item}</td>
                  <td className={cn(TD, NUM)}>{t.qty}</td>
                  <td className={cn(TD, "text-[10px] text-muted-foreground")}>{t.unit}</td>
                  <td className={cn(TD, NUM)}>${t.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40 font-semibold">
                <td className={TD} colSpan={5}>Total transferred ({tx.length} moves)</td>
                <td className={cn(TD, NUM)}>${txTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </TblWrap>
      </ReportCard>
    </div>
  );
}
