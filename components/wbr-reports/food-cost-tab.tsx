"use client";

import {
  fmt$,
  fmtPct,
  ING_LIST,
  DD_CAMPAIGNS,
  type WbrData,
} from "@/lib/mock/wbr-reports.mock";
import {
  ReportCard,
  Chip,
  StoreCell,
  DataBar,
  DivBar,
  TblWrap,
  heat,
  TBL,
  TH,
  TD,
  NUM,
} from "./primitives";
import { cn } from "@/lib/utils";

export function FoodCostTab({ data }: { data: WbrData }) {
  const { rows } = data;
  const maxL4 = Math.max(1, ...rows.map((r) => r.disputes.last4w));

  return (
    <div className="grid gap-4">
      {/* Waste GW vs ALT */}
      <ReportCard title="Waste — GateWay vs Altametrix" hint="GW: green <3 · amber 3–7 · red >7">
        <TblWrap>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
                <th className={cn(TH, NUM)}>Sales</th>
                <th className={cn(TH, NUM)}>GW %</th>
                <th className={cn(TH, NUM)}>ALT %</th>
                <th className={TH}>Diff pp</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const gw = r.wasteGWPct;
                const diff = +(gw - r.wasteALTPct).toFixed(1);
                const style = gw < 3 ? heat("green", 14) : gw <= 7 ? heat("amber", 18) : heat("red", 16);
                return (
                  <tr key={r.store.id}>
                    <td className={TD}>
                      <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                    </td>
                    <td className={cn(TD, NUM)}>{fmt$(r.sales)}</td>
                    <td className={cn(TD, NUM)} style={style}>{gw.toFixed(2)}%</td>
                    <td className={cn(TD, NUM)}>{r.wasteALTPct.toFixed(2)}%</td>
                    <td className={TD}>
                      <Chip tone={diff > 0 ? "bad" : "ok"}>{diff > 0 ? "+" : ""}{diff} pp</Chip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Portioning variance + DD disputes */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ReportCard title="Portioning variance" hint="negative = under-portioned · positive = over">
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Store</th>
                  <th className={cn(TH, NUM)}>Total var %</th>
                  <th className={TH}>Distribution</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const v = r.portionVarPct;
                  const st =
                    Math.abs(v) <= 2 ? <Chip tone="ok">OK</Chip> :
                    v > 5 ? <Chip tone="bad">High</Chip> :
                    v < -2 ? <Chip tone="warn">Under</Chip> :
                    <Chip tone="warn">Watch</Chip>;
                  return (
                    <tr key={r.store.id}>
                      <td className={TD}>
                        <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                      </td>
                      <td className={cn(TD, NUM)}>{v > 0 ? "+" : ""}{v.toFixed(2)}%</td>
                      <td className={TD}><DivBar value={v} /></td>
                      <td className={TD}>{st}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TblWrap>
        </ReportCard>

        <ReportCard title="DoorDash disputes" hint="recovered $ · trailing 4 weeks">
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Store</th>
                  <th className={cn(TH, NUM)}>DD Sales</th>
                  <th className={cn(TH, NUM)}>Disputed $</th>
                  <th className={cn(TH, NUM)}>Last 4 wks</th>
                  <th className={TH}>Recovery</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.store.id}>
                    <td className={TD}>
                      <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                    </td>
                    <td className={cn(TD, NUM)}>{fmt$(r.disputes.ddSales)}</td>
                    <td className={cn(TD, NUM)}>${r.disputes.amount.toFixed(1)}</td>
                    <td className={cn(TD, NUM)}>${r.disputes.last4w}</td>
                    <td className={TD}><DataBar pct={(r.disputes.last4w / maxL4) * 100} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TblWrap>
        </ReportCard>
      </div>

      {/* Portioning by ingredient (matrix) */}
      <ReportCard title="Portioning by ingredient" hint="green = under target · red ≥ 2× target">
        <TblWrap tall={rows.length > 9}>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
                {ING_LIST.map((g) => (
                  <th key={g.key} className={cn(TH, NUM)}>{g.short}</th>
                ))}
                <th className={cn(TH, NUM)}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.store.id}>
                  <td className={TD}>
                    <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                  </td>
                  {r.portioning.rows.map((g) => {
                    const style =
                      g.pct < 0 ? heat("green", Math.min(14, Math.abs(g.pct) * 6)) :
                      g.pct >= g.target * 2 ? heat("red", 16) :
                      g.pct > g.target ? heat("amber", 12) : undefined;
                    return (
                      <td key={g.key} className={cn(TD, NUM)} style={style}>
                        {g.pct > 0 ? "+" : ""}{g.pct.toFixed(1)}%
                      </td>
                    );
                  })}
                  <td className={cn(TD, NUM, "font-semibold")}>
                    {r.portioning.totalPct > 0 ? "+" : ""}{r.portioning.totalPct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Orders vs Sales (supplier) */}
      <ReportCard title="Orders vs Sales (BlueLine / Pepsi)" hint="BL % heat: red >32 of weekly sales">
        <TblWrap tall={rows.length > 9}>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
                <th className={cn(TH, NUM)}>Weekly Sales</th>
                <th className={cn(TH, NUM)}>BL order $</th>
                <th className={cn(TH, NUM)}>BL %</th>
                <th className={cn(TH, NUM)}>Pepsi $</th>
                <th className={cn(TH, NUM)}>Pepsi %</th>
                <th className={cn(TH, NUM)}>4wk BL%</th>
                <th className={cn(TH, NUM)}>12wk BL%</th>
                <th className={cn(TH, NUM)}>6mo BL%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sp = r.supplier;
                return (
                  <tr key={r.store.id}>
                    <td className={TD}>
                      <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                    </td>
                    <td className={cn(TD, NUM)}>{fmt$(r.sales)}</td>
                    <td className={cn(TD, NUM)}>{fmt$(sp.blueline)}</td>
                    <td className={cn(TD, NUM)} style={sp.blPct > 32 ? heat("red", 16) : undefined}>{fmtPct(sp.blPct)}</td>
                    <td className={cn(TD, NUM)}>{fmt$(sp.pepsi)}</td>
                    <td className={cn(TD, NUM)}>{fmtPct(sp.pepsiPct)}</td>
                    <td className={cn(TD, NUM)}>{sp.bl4w}%</td>
                    <td className={cn(TD, NUM)}>{sp.bl12w}%</td>
                    <td className={cn(TD, NUM)}>{sp.bl6m}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* DoorDash campaigns */}
      <ReportCard title="DoorDash campaigns" hint="always-on + slow-day boosts · network-wide">
        <div className="flex flex-col gap-1.5 p-4">
          {DD_CAMPAIGNS.map((cp) => (
            <div key={cp.name} className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="font-semibold">{cp.name}</span>
              <Chip tone="muted">{cp.hours}</Chip>
              <span className="text-[11px] text-muted-foreground">{cp.items}</span>
              <Chip tone="info">cost {cp.costPct}</Chip>
            </div>
          ))}
        </div>
      </ReportCard>
    </div>
  );
}
