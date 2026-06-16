"use client";

import { fmt$, type WbrData } from "@/lib/mock/wbr-reports.mock";
import {
  ReportCard,
  Chip,
  StoreCell,
  Stars,
  TblWrap,
  heat,
  TBL,
  TH,
  TD,
  NUM,
} from "./primitives";
import { cn } from "@/lib/utils";

function QaChip({ n }: { n: number }) {
  return <Chip tone={n === 3 ? "ok" : n === 2 ? "warn" : "bad"}>{n}/3</Chip>;
}

export function ServiceTab({ data }: { data: WbrData }) {
  const { rows } = data;
  const single = data.scope === "store";

  return (
    <div className="grid gap-4">
      {/* QA scorecard */}
      <ReportCard title="QA scorecard" hint="3 checks per category">
        <TblWrap>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
                <th className={TH}>Guest</th>
                <th className={TH}>Lobby</th>
                <th className={TH}>Upselling</th>
                <th className={TH}>Drive-Thru</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.store.id}>
                  <td className={TD}>
                    <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                  </td>
                  <td className={TD}><QaChip n={r.qa.guestPass} /></td>
                  <td className={TD}><QaChip n={r.qa.lobbyPass} /></td>
                  <td className={TD}><QaChip n={r.qa.upsellPass} /></td>
                  <td className={TD}>
                    {r.qa.driveThruPass ? <QaChip n={r.qa.driveThruPass} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Phone calls */}
      <ReportCard title="Phone calls" hint="missed % heat · answered-by counts">
        <TblWrap tall={rows.length > 9}>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
                <th className={cn(TH, NUM)}>Phone $</th>
                <th className={cn(TH, NUM)}>Total calls</th>
                <th className={cn(TH, NUM)}>Missed</th>
                <th className={cn(TH, NUM)}>Missed %</th>
                <th className={cn(TH, NUM)}>In-store</th>
                <th className={cn(TH, NUM)}>Store Mgr</th>
                <th className={cn(TH, NUM)}>Call Center</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cx = r.callsExt;
                const cnt = (n: number) => (
                  <>
                    {n} <span className="text-[10px] text-muted-foreground">{cx.total ? Math.round((n / cx.total) * 100) : 0}%</span>
                  </>
                );
                return (
                  <tr key={r.store.id}>
                    <td className={TD}>
                      <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                    </td>
                    <td className={cn(TD, NUM)}>{fmt$(r.channels.phone)}</td>
                    <td className={cn(TD, NUM)}>{cx.total}</td>
                    <td className={cn(TD, NUM)}>{cx.missed}</td>
                    <td className={cn(TD, NUM)} style={cx.missedPct > 8 ? heat("red", (cx.missedPct / 38) * 25) : undefined}>{cx.missedPct}%</td>
                    <td className={cn(TD, NUM)}>{cnt(cx.inStore)}</td>
                    <td className={cn(TD, NUM)}>{cnt(cx.storeManager)}</td>
                    <td className={cn(TD, NUM)}>{cnt(cx.callCenter)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Customer reviews */}
      <ReportCard title="Customer reviews" hint="this week · Google + Yelp">
        <TblWrap>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
                <th className={cn(TH, NUM)}>Count</th>
                <th className={TH}>Avg rating</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.store.id}>
                  <td className={TD}>
                    <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                  </td>
                  <td className={cn(TD, NUM)}>{r.reviews.count}</td>
                  <td className={TD}>
                    <span className="flex items-center gap-2">
                      <Stars rating={r.reviews.avg} />
                      <span className="font-mono text-[11px] tabular-nums">{r.reviews.avg.toFixed(1)}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TblWrap>

        {/* Verbatims */}
        <div className="divide-y border-t">
          {(single ? rows[0]?.reviewsList ?? [] : rows.flatMap((r) => r.reviewsList.slice(0, 1))).map((v, i) => (
            <div key={i} className="px-4 py-2.5 text-[12.5px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{v.name}</span>
                <span className="text-[11px] text-muted-foreground">· {v.date} · Google</span>
                <Stars rating={v.rating} />
                {v.recommend ? <Chip tone="ok">Recommends</Chip> : <Chip tone="bad">Not recommended</Chip>}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{v.comment}</p>
            </div>
          ))}
        </div>
      </ReportCard>
    </div>
  );
}
