"use client";

import {
  fmt$,
  fmtPct,
  fmtNum,
  wow,
  PROMO_CODES,
  TOP_ITEMS,
  PROMO_CALENDAR,
  storeTrend,
  type WbrData,
  type Cmp,
} from "@/lib/mock/wbr-reports.mock";
import {
  ReportCard,
  DeltaBadge,
  Chip,
  Kpi,
  StoreCell,
  DataBar,
  Spark,
  TblWrap,
  heat,
  TBL,
  TH,
  TD,
  NUM,
} from "./primitives";
import { cn } from "@/lib/utils";

const CH_COLS: [keyof WbrData["totals"]["channels"], string][] = [
  ["register", "Register"],
  ["phone", "Phone"],
  ["doordash", "DoorDash"],
  ["ubereats", "UberEats"],
  ["webInstore", "Web In-store"],
  ["mobInstore", "Mobile In-store"],
  ["driveThru", "Drive-Thru"],
];

function CmpCells({ c }: { c: Cmp }) {
  return (
    <>
      {(["wow", "pop", "qoq", "yoy"] as const).map((k) => (
        <td key={k} className={TD}>
          <DeltaBadge value={c[k]} />
        </td>
      ))}
    </>
  );
}

export function SalesTab({ data }: { data: WbrData }) {
  const single = data.scope === "store";
  const { totals, prevTotals, rows } = data;
  const promoPct = (totals.promoTotal / totals.sales) * 100;
  const colMax = Object.fromEntries(
    CH_COLS.map(([k]) => [k, Math.max(1, ...rows.map((r) => r.channels[k]))])
  );
  const maxShare = Math.max(...TOP_ITEMS.map((t) => t.qtyPct));

  return (
    <div className="grid gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Sales" value={fmt$(totals.sales)} delta={wow(totals.sales, prevTotals.sales)} />
        <Kpi
          label="Customers"
          value={fmtNum(totals.customers)}
          delta={wow(totals.customers, prevTotals.customers)}
        />
        <Kpi
          label="Avg ticket"
          value={`$${totals.avgTicket.toFixed(2)}`}
          delta={wow(totals.avgTicket, prevTotals.avgTicket)}
        />
        <Kpi label="Promo-to-sales" value={fmtPct(promoPct)} />
      </div>

      {/* Channel sales by store */}
      <ReportCard title="Channel Sales by Store" hint="WoW channel sales · $ per channel">
        <TblWrap tall={rows.length > 9}>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
                <th className={cn(TH, NUM)}>Total $</th>
                <th className={TH}>WoW</th>
                {single && <th className={TH}>4-wk trend</th>}
                {CH_COLS.map(([, l]) => (
                  <th key={l} className={cn(TH, NUM)}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.store.id}>
                  <td className={TD}>
                    <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                  </td>
                  <td className={cn(TD, NUM, "font-semibold")}>{fmt$(r.sales)}</td>
                  <td className={TD}>
                    <DeltaBadge value={wow(r.sales, data.prevRows[i].sales)} />
                  </td>
                  {single && (
                    <td className={TD}>
                      <Spark values={storeTrend(r.store, "sales")} />
                    </td>
                  )}
                  {CH_COLS.map(([k]) => {
                    const v = r.channels[k];
                    return (
                      <td
                        key={k}
                        className={cn(TD, NUM)}
                        style={v ? heat("brand", (v / colMax[k]) * 25) : undefined}
                      >
                        {v ? fmt$(v) : <span className="text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {!single && (
              <tfoot>
                <tr className="border-t bg-muted/40 font-semibold">
                  <td className={TD}>All stores</td>
                  <td className={cn(TD, NUM)}>{fmt$(totals.sales)}</td>
                  <td className={TD}>
                    <DeltaBadge value={wow(totals.sales, prevTotals.sales)} />
                  </td>
                  {CH_COLS.map(([k]) => (
                    <td key={k} className={cn(TD, NUM)}>{fmt$(totals.channels[k])}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </TblWrap>
      </ReportCard>

      {/* Sales & customers comparison */}
      <ReportCard title="Sales & Customers comparison" hint="WoW · PoP · QoQ · YoY">
        <TblWrap tall={rows.length > 9}>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
                <th className={cn(TH, NUM)}>Customers</th>
                <th className={TH}>WoW</th>
                <th className={TH}>PoP</th>
                <th className={TH}>QoQ</th>
                <th className={TH}>YoY</th>
                <th className={cn(TH, NUM)}>Sales</th>
                <th className={TH}>WoW</th>
                <th className={TH}>PoP</th>
                <th className={TH}>QoQ</th>
                <th className={TH}>YoY</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.store.id}>
                  <td className={TD}>
                    <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                  </td>
                  <td className={cn(TD, NUM)}>{fmtNum(r.customers)}</td>
                  <CmpCells c={r.cmp.customers} />
                  <td className={cn(TD, NUM, "font-semibold")}>{fmt$(r.sales)}</td>
                  <CmpCells c={r.cmp.sales} />
                </tr>
              ))}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Promo + Top items */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ReportCard title="Promo" hint="red >9% · green <5% of sales">
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Store</th>
                  <th className={cn(TH, NUM)}>Promo $</th>
                  <th className={cn(TH, NUM)}>To-sales</th>
                  <th className={TH}></th>
                  {PROMO_CODES.map((cd) => (
                    <th key={cd} className={cn(TH, NUM)}>{cd}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pr = r.promoToSales;
                  const style =
                    pr > 9 ? heat("red", 16) : pr < 5 ? heat("green", 14) : undefined;
                  return (
                    <tr key={r.store.id}>
                      <td className={TD}>
                        <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                      </td>
                      <td className={cn(TD, NUM)}>{fmt$(r.promoTotal)}</td>
                      <td className={cn(TD, NUM)} style={style}>{fmtPct(pr)}</td>
                      <td className={TD}><DataBar pct={(pr / 12) * 100} /></td>
                      {PROMO_CODES.map((cd) => (
                        <td key={cd} className={cn(TD, NUM)}>{fmt$(r.promoCodes[cd])}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TblWrap>
        </ReportCard>

        <ReportCard title="Top items" hint="company-wide · this week">
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={cn(TH, NUM)}>#</th>
                  <th className={TH}>Item</th>
                  <th className={cn(TH, NUM)}>Price</th>
                  <th className={cn(TH, NUM)}>Qty</th>
                  <th className={cn(TH, NUM)}>Sales</th>
                  <th className={TH}>Share</th>
                </tr>
              </thead>
              <tbody>
                {TOP_ITEMS.map((t, i) => (
                  <tr key={t.item}>
                    <td className={cn(TD, NUM, "text-muted-foreground")}>{i + 1}</td>
                    <td className={cn(TD, "font-semibold")}>{t.item}</td>
                    <td className={cn(TD, NUM)}>${t.price.toFixed(2)}</td>
                    <td className={cn(TD, NUM)}>{fmtNum(t.qty)}</td>
                    <td className={cn(TD, NUM)}>{fmt$(t.sales)}</td>
                    <td className={TD}>
                      <span className="flex items-center gap-1.5">
                        <DataBar pct={(t.qtyPct / maxShare) * 100} />
                        <span className="text-[11px] text-muted-foreground">{t.qtyPct}%</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TblWrap>
        </ReportCard>
      </div>

      {/* LTO + promo calendar */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ReportCard title="LTO — Mtn Dew Mango Rush" hint="Price $2.99 · Cost $0.92 · F&P 30.8%">
          <TblWrap tall={rows.length > 9}>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Store</th>
                  <th className={cn(TH, NUM)}>Item $</th>
                  <th className={cn(TH, NUM)}>% Sales</th>
                  <th className={cn(TH, NUM)}>Qty</th>
                  <th className={cn(TH, NUM)}>In-store</th>
                  <th className={TH}>WoW Qty</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.store.id}>
                    <td className={TD}>
                      <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                    </td>
                    <td className={cn(TD, NUM)}>{fmt$(r.lto.sales)}</td>
                    <td className={cn(TD, NUM)}>{r.lto.pctOfSales.toFixed(2)}%</td>
                    <td className={cn(TD, NUM)}>{r.lto.qty}</td>
                    <td className={cn(TD, NUM)}>{r.lto.inStoreQty}</td>
                    <td className={TD}><DeltaBadge value={r.lto.wowQty} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TblWrap>
        </ReportCard>

        <ReportCard title="Promo & LTO calendar" hint="upcoming windows · all stores">
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Promotion</th>
                  <th className={TH}>Dates</th>
                  <th className={TH}>Channel</th>
                </tr>
              </thead>
              <tbody>
                {PROMO_CALENDAR.map((p) => (
                  <tr key={p.label}>
                    <td className={cn(TD, "font-semibold")}>{p.label}</td>
                    <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>{p.range}</td>
                    <td className={TD}><Chip tone="muted">{p.channel}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TblWrap>
        </ReportCard>
      </div>
    </div>
  );
}
