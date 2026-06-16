"use client";

import { FileText } from "lucide-react";
import { fmt$, type WbrData } from "@/lib/mock/wbr-reports.mock";
import {
  ReportCard,
  Chip,
  Kpi,
  StoreCell,
  TblWrap,
  heat,
  TBL,
  TH,
  TD,
  NUM,
} from "./primitives";
import { cn } from "@/lib/utils";

/** Reports defined in the WBR template but not yet digitized */
function PlaceholderCard({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card p-8 text-center">
      <FileText className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-[12px] text-muted-foreground">{note}</p>
      <Chip tone="muted">Coming soon</Chip>
    </div>
  );
}

export function CashTab({ data }: { data: WbrData }) {
  const { rows } = data;
  const totalVariance = rows.reduce((a, r) => a + r.deposit.variance, 0);
  const totalBank = rows.reduce((a, r) => a + r.deposit.bank, 0);
  const shortStores = rows.filter((r) => r.deposit.variance < -20).length;

  return (
    <div className="grid gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="Bank deposits" value={fmt$(totalBank)} />
        <Kpi
          label="Net variance"
          value={(totalVariance < 0 ? "−$" : "$") + Math.abs(totalVariance).toFixed(2)}
        />
        <Kpi label="Short stores" value={shortStores} />
      </div>

      {/* Cash variance reconciliation */}
      <ReportCard title="Cash variance" hint="bank vs cash sales · short stores flagged">
        <TblWrap tall={rows.length > 9}>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
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
                    <td className={cn(TD, NUM)}>{fmt$(r.deposit.cashSales)}</td>
                    <td className={cn(TD, NUM)}>{fmt$(r.deposit.cashDrop)}</td>
                    <td className={cn(TD, NUM)}>{fmt$(r.deposit.bank)}</td>
                    <td
                      className={cn(TD, NUM, v < 0 && "font-semibold text-red-600 dark:text-red-400")}
                      style={v < -20 ? heat("red", 16) : undefined}
                    >
                      {txt}
                    </td>
                    <td className={TD}>
                      {v < -20 ? <Chip tone="bad">Short</Chip> : v > 5 ? <Chip tone="warn">Over</Chip> : <Chip tone="ok">OK</Chip>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Reimbursements summary */}
      <ReportCard title="Reimbursements" hint="out-of-pocket totals by store">
        <TblWrap>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
                <th className={cn(TH, NUM)}>Items</th>
                <th className={cn(TH, NUM)}>Total owed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const total = r.moneyOwed.reduce((a, m) => a + m.amount, 0);
                return (
                  <tr key={r.store.id}>
                    <td className={TD}>
                      <StoreCell name={r.store.name} market={r.store.market} num={r.store.num} />
                    </td>
                    <td className={cn(TD, NUM)}>{r.moneyOwed.length}</td>
                    <td className={cn(TD, NUM)}>{total ? `$${total.toFixed(2)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Not-yet-digitized reports */}
      <div className="grid gap-4 md:grid-cols-2">
        <PlaceholderCard
          title="Invoice & vendor reconciliation"
          note="Weekly AP invoice matching against POs — pending data source."
        />
        <PlaceholderCard
          title="Petty cash & safe count log"
          note="Daily safe count and petty-cash ledger — pending data source."
        />
      </div>
    </div>
  );
}
