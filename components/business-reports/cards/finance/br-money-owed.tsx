"use client";

import { useMemo, useState } from "react";
import { HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DetailField } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1MetricGrid } from "@/components/dashboard-v1/v1-ui";
import type { PagedColumn } from "@/components/business-reports/paged-table";
import { fmt$2, fmtDate } from "@/components/business-reports/report-format";
import type { WbrBulkMoneyOwed, WbrBulkResponse } from "@/types/business-reports.types";
import { CARD_LIST_LIMIT, NO_VALUE, plural } from "@/components/business-reports/cards/operations/br-shared";
import { RecordsDialog, useWbrRecords } from "@/components/business-reports/cards/quality/br-records";

const amountOf = (m: WbrBulkMoneyOwed): number => parseFloat(m.expenses_amount) || 0;

function money(amount: string): string {
  const n = parseFloat(amount);
  return Number.isNaN(n) ? amount : fmt$2(n);
}

function ApproveBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">{NO_VALUE}</span>;
  const yes = value.toLowerCase() === "yes";
  const no = value.toLowerCase() === "no";
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-4 px-1.5 py-0 text-[10px]",
        yes && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        no && "bg-red-500/15 text-red-600 dark:text-red-400",
        !yes && !no && "bg-muted text-muted-foreground",
      )}
    >
      {value}
    </Badge>
  );
}

const COLUMNS: PagedColumn<WbrBulkMoneyOwed>[] = [
  { key: "date", header: "Date", sortValue: (m) => m.expense_date, render: (m) => fmtDate(m.expense_date), className: "whitespace-nowrap" },
  { key: "store", header: "Store", sortValue: (m) => m.store_label, render: (m) => m.store_label },
  { key: "employee", header: "Employee", sortValue: (m) => m.employee_full_name, render: (m) => m.employee_full_name },
  { key: "amount", header: "Amount", numeric: true, sortValue: amountOf, render: (m) => money(m.expenses_amount) },
  { key: "approve", header: "Approved", sortValue: (m) => m.approve, render: (m) => <ApproveBadge value={m.approve} /> },
  { key: "bi", header: "BI", sortValue: (m) => m.bi_approve, render: (m) => <ApproveBadge value={m.bi_approve} /> },
];

function MoneyOwedDetail({ m }: { m: WbrBulkMoneyOwed }) {
  return (
    <>
      <DetailField label="Store" value={m.store_label} />
      <DetailField label="Amount" value={money(m.expenses_amount)} />
      <DetailField label="Expense Date" value={fmtDate(m.expense_date)} />
      <DetailField label="Store Mgr" value={m.store_manager_full_name} />
      <DetailField label="Consulted" value={m.manager_consulted_full_name} />
      <DetailField label="Group Mgr" value={m.group_manager_full_name} />
      <DetailField label="Approved" value={<ApproveBadge value={m.approve} />} />
      <DetailField label="Description" value={m.expense_description} wrap />
      <DetailField label="Notes" value={m.notes} wrap />
      <DetailField label="Rejection Reason" value={m.rejection_reason} wrap />
      <DetailField label="BI Reviewer" value={m.bi_full_name} />
      <DetailField label="BI Approved" value={<ApproveBadge value={m.bi_approve} />} />
      <DetailField label="BI Notes" value={m.bi_notes} wrap />
      <DetailField label="BI Rejection" value={m.bi_rejection_reason} wrap />
    </>
  );
}

/** Employee reimbursements across the stores: count, total, the latest records. */
export function BrMoneyOwedCard({ data }: { data: WbrBulkResponse }) {
  const records = useWbrRecords(data, "money_owed");
  const [open, setOpen] = useState(false);
  const latest = useMemo(
    () => [...records].sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
    [records],
  );
  const total = useMemo(() => records.reduce((s, m) => s + amountOf(m), 0), [records]);
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
            <V1Metric label="Total Owed" value={fmt$2(total)} accent="text-rose-600 dark:text-rose-400" size="sm" />
          </V1MetricGrid>
          <div className="space-y-1.5">
            {latest.slice(0, CARD_LIST_LIMIT).map((m) => (
              <div key={m.id} className="border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[11px] font-medium">
                    {m.employee_full_name}
                    <span className="ms-1.5 text-[10px] font-normal text-muted-foreground">
                      {m.store_label} · {fmtDate(m.expense_date)}
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
      {open && (
        <RecordsDialog
          title="Money Owed"
          noun="record"
          rows={records}
          columns={COLUMNS}
          rowKey={(m) => m.id}
          initialSort="date"
          detailTitle={(m) => (
            <span className="flex items-center justify-between gap-2">
              <span>{m.employee_full_name}</span>
              <span className="tabular-nums">{money(m.expenses_amount)}</span>
            </span>
          )}
          renderDetail={(m) => <MoneyOwedDetail m={m} />}
          onClose={() => setOpen(false)}
        />
      )}
    </V1Card>
  );
}
