"use client";

import { useMemo, useState } from "react";
import { HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1MetricGrid } from "@/components/dashboard-v1/v1-ui";
import type { PagedColumn } from "@/components/business-reports/paged-table";
import { compareText, fmt$2, fmt$Compact, fmtDate } from "@/components/business-reports/report-format";
import type { WbrBulkResponse } from "@/types/business-reports.types";
import { CARD_LIST_LIMIT, Money, NO_VALUE, plural } from "@/components/business-reports/cards/operations/br-shared";
import {
  DetailItem,
  RecordsDialog,
  useWbrRecords,
  type RecordStore,
  type WbrRecord,
} from "@/components/business-reports/cards/quality/br-records";

type MoneyOwed = WbrRecord<"money_owed">;

const amountOf = (m: MoneyOwed): number => parseFloat(m.expenses_amount) || 0;
const dateOf = (m: MoneyOwed) => m.expense_date;
const answer = (v: string | null) => v?.trim().toLowerCase() ?? "";
const sumOf = (rows: MoneyOwed[]) => rows.reduce((s, m) => s + amountOf(m), 0);

function money(amount: string): string {
  const n = parseFloat(amount);
  return Number.isNaN(n) ? amount : fmt$2(n);
}

function ApproveBadge({ value, large = false }: { value: string | null; large?: boolean }) {
  if (!value) return <span className="text-muted-foreground">{NO_VALUE}</span>;
  const yes = answer(value) === "yes";
  const no = answer(value) === "no";
  return (
    <Badge
      variant="secondary"
      className={cn(
        large ? "px-2 py-0.5 text-xs" : "h-4 px-1.5 py-0 text-[10px]",
        yes && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        no && "bg-red-500/15 text-red-600 dark:text-red-400",
        !yes && !no && "bg-muted text-muted-foreground",
      )}
    >
      {value}
    </Badge>
  );
}

const COLUMNS: PagedColumn<MoneyOwed>[] = [
  { key: "date", header: "Date", sortValue: dateOf, render: (m) => fmtDate(m.expense_date), className: "whitespace-nowrap" },
  { key: "store", header: "Store", sortValue: (m) => m.storeDisplay, render: (m) => m.storeDisplay },
  { key: "employee", header: "Employee", sortValue: (m) => m.employee_full_name, render: (m) => m.employee_full_name },
  {
    key: "desc",
    header: "Description",
    render: (m) => <span className="line-clamp-2 min-w-[220px] whitespace-normal">{m.expense_description || NO_VALUE}</span>,
  },
  { key: "amount", header: "Amount", numeric: true, sortValue: amountOf, render: (m) => money(m.expenses_amount) },
  { key: "approve", header: "Approved", sortValue: (m) => m.approve, render: (m) => <ApproveBadge value={m.approve} large /> },
  { key: "bi", header: "BI", sortValue: (m) => m.bi_approve, render: (m) => <ApproveBadge value={m.bi_approve} large /> },
];

const STORE_COLUMNS: PagedColumn<RecordStore<MoneyOwed>>[] = [
  { key: "total", header: "Total owed", numeric: true, sortValue: (s) => sumOf(s.rows), render: (s) => fmt$2(sumOf(s.rows)) },
  {
    key: "approved",
    header: "Approved",
    numeric: true,
    sortValue: (s) => s.rows.filter((m) => answer(m.approve) === "yes").length,
    render: (s) => s.rows.filter((m) => answer(m.approve) === "yes").length.toLocaleString(),
  },
  {
    key: "rejected",
    header: "Rejected",
    numeric: true,
    sortValue: (s) => s.rows.filter((m) => answer(m.approve) === "no").length,
    render: (s) => s.rows.filter((m) => answer(m.approve) === "no").length.toLocaleString(),
  },
];

const searchText = (m: MoneyOwed) =>
  `${m.employee_full_name} ${m.storeDisplay} ${m.expense_description ?? ""} ${m.store_manager_full_name ?? ""} ${m.notes ?? ""}`;

function MoneyOwedDetail({ m }: { m: MoneyOwed }) {
  return (
    <>
      <DetailItem label="Store" value={m.storeDisplay} />
      <DetailItem label="Amount" value={money(m.expenses_amount)} />
      <DetailItem label="Expense Date" value={fmtDate(m.expense_date)} />
      <DetailItem label="Employee" value={m.employee_full_name} />
      <DetailItem label="Store Mgr" value={m.store_manager_full_name} />
      <DetailItem label="Consulted" value={m.manager_consulted_full_name} />
      <DetailItem label="Group Mgr" value={m.group_manager_full_name} />
      <DetailItem label="Approved" value={<ApproveBadge value={m.approve} large />} />
      <DetailItem label="Description" value={m.expense_description} wide />
      <DetailItem label="Notes" value={m.notes} wide />
      <DetailItem label="Rejection Reason" value={m.rejection_reason} wide />
      <DetailItem label="BI Reviewer" value={m.bi_full_name} />
      <DetailItem label="BI Approved" value={<ApproveBadge value={m.bi_approve} large />} />
      <DetailItem label="BI Notes" value={m.bi_notes} wide />
      <DetailItem label="BI Rejection" value={m.bi_rejection_reason} wide />
    </>
  );
}

function MoneyOwedDialog({ records, total, onClose }: { records: MoneyOwed[]; total: number; onClose: () => void }) {
  const counts = useMemo(
    () => ({
      approved: records.filter((m) => answer(m.approve) === "yes").length,
      rejected: records.filter((m) => answer(m.approve) === "no").length,
      pending: records.filter((m) => !m.approve).length,
    }),
    [records],
  );
  return (
    <RecordsDialog
      title="Money Owed"
      category="finance"
      noun="record"
      rows={records}
      dateOf={dateOf}
      stats={[
        { label: "Total owed", value: fmt$Compact(total), sub: fmt$2(total), tone: "text-rose-600 dark:text-rose-400" },
        { label: "Approved", value: counts.approved.toLocaleString(), tone: "text-emerald-600 dark:text-emerald-400" },
        { label: "Rejected", value: counts.rejected.toLocaleString(), tone: counts.rejected > 0 ? "text-red-600 dark:text-red-400" : undefined },
        { label: "Not decided", value: counts.pending.toLocaleString() },
      ]}
      storeColumns={STORE_COLUMNS}
      columns={COLUMNS}
      rowKey={(m) => m.id}
      initialSort="date"
      searchText={searchText}
      detailTitle={(m) => (
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span>{m.employee_full_name}</span>
          <span className="tabular-nums">{money(m.expenses_amount)}</span>
        </span>
      )}
      renderDetail={(m) => <MoneyOwedDetail m={m} />}
      onClose={onClose}
    />
  );
}

/** Employee reimbursements across the stores: count, total, the latest records. */
export function BrMoneyOwedCard({ data }: { data: WbrBulkResponse }) {
  const records = useWbrRecords(data, "money_owed");
  const [open, setOpen] = useState(false);
  const latest = useMemo(
    () => [...records].sort((a, b) => compareText(b.expense_date, a.expense_date)),
    [records],
  );
  const total = useMemo(() => sumOf(records), [records]);
  const empty = records.length === 0;

  return (
    <V1Card
      reportId="br-money-owed"
      title="Money Owed"
      category="finance"
      period="R"
      span={2}
      headerNote={plural(records.length, "record")}
      onExpand={empty ? undefined : () => setOpen(true)}
    >
      {empty ? (
        <V1Empty icon={HandCoins}>No reimbursements in this range.</V1Empty>
      ) : (
        <div className="space-y-2">
          <V1MetricGrid cols={2}>
            <V1Metric label="Records" value={records.length.toLocaleString()} size="sm" />
            <V1Metric label="Total Owed" value={<Money value={total} />} accent="text-rose-600 dark:text-rose-400" size="sm" />
          </V1MetricGrid>
          <div className="space-y-1.5">
            {latest.slice(0, CARD_LIST_LIMIT).map((m) => (
              <div key={m.id} className="border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[11px] font-medium">
                    {m.employee_full_name}
                    <span className="ms-1.5 text-[10px] font-normal text-muted-foreground">
                      {m.storeDisplay} · {fmtDate(m.expense_date)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold tabular-nums">
                    {money(m.expenses_amount)}
                    <ApproveBadge value={m.approve} />
                  </span>
                </div>
                {m.expense_description && (
                  <p className="line-clamp-1 text-[10px] text-muted-foreground">{m.expense_description}</p>
                )}
              </div>
            ))}
            {records.length > CARD_LIST_LIMIT && (
              <p className="text-[10px] text-muted-foreground">
                +{(records.length - CARD_LIST_LIMIT).toLocaleString()} more — open for all
              </p>
            )}
          </div>
        </div>
      )}
      {open && <MoneyOwedDialog records={records} total={total} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
