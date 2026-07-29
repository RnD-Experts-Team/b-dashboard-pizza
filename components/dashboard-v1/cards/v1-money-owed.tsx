"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { HandCoins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WbrMoneyOwed } from "@/types/hooks.types";
import { fmt$2, fmtDate, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import {
  V1Metric,
  V1MetricGrid,
  V1Empty,
} from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog, DetailField } from "@/components/dspr/wbr-detail-dialog";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1MoneyOwedCard — weekly employee reimbursements. Body: count + total tiles
 *  and a compact list (employee, amount, approve badge). Expand: full records
 *  with all approvers, notes and rejection reasons. Mirrors wbr-money-owed-card.
 * ────────────────────────────────────────────────────────────────────────── */

function money(amount: string): string {
  const n = parseFloat(amount);
  return Number.isNaN(n) ? amount : fmt$2(n);
}

function ApproveBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
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

export function V1MoneyOwedCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: WbrMoneyOwed[];
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (isLoading)
    return (
      <div className={["col-span-1 md:col-span-1 lg:col-span-2", className].filter(Boolean).join(" ")}>
        <WbrCardSkeleton />
      </div>
    );
  if (!data)
    return (
      <V1Card title="Money Owed" category="finance" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const empty = data.length === 0;
  const totalAmount = data.reduce(
    (sum, m) => sum + (parseFloat(m.expenses_amount) || 0),
    0,
  );

  return (
      <V1Card
        title="Money Owed"
        category="finance"
        period="W"
        span={span}
        className={className}
        headerNote={`${data.length} record${data.length === 1 ? "" : "s"}`}
        onExpand={empty ? undefined : () => setOpen(true)}
      >
        {empty ? (
          <V1Empty icon={HandCoins}>No reimbursements this week.</V1Empty>
        ) : (
          <div className="space-y-2">
            <V1MetricGrid cols={2}>
              <V1Metric label="Records" value={data.length} size="sm" />
              <V1Metric
                label="Total Owed"
                value={fmt$2(totalAmount)}
                accent="text-rose-600 dark:text-rose-400"
                size="sm"
              />
            </V1MetricGrid>

            <div className="space-y-1.5">
              {data.map((m) => (
                <div
                  key={m.id}
                  className="border-b border-border/40 pb-1.5 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium">
                      {m.employee_full_name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold tabular-nums">
                      {money(m.expenses_amount)}
                      <ApproveBadge value={m.approve} />
                    </span>
                  </div>
                  {m.expense_description && (
                    <p className="line-clamp-1 text-[10px] text-muted-foreground">
                      {m.expense_description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Money Owed"
        badgeText={`${data.length} record${data.length === 1 ? "" : "s"}`}
      >
        <div className="space-y-3">
          {data.map((m) => (
            <div
              key={m.id}
              className="space-y-2 rounded-lg border bg-background/40 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {m.employee_full_name}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {money(m.expenses_amount)}
                </span>
              </div>
              <div className="space-y-1.5">
                <DetailField label="Expense Date" value={fmtDate(m.expense_date)} />
                <DetailField label="Store Mgr" value={m.store_manager_full_name} />
                <DetailField
                  label="Consulted"
                  value={m.manager_consulted_full_name}
                />
                <DetailField label="Group Mgr" value={m.group_manager_full_name} />
                <DetailField
                  label="Approved"
                  value={<ApproveBadge value={m.approve} />}
                />
                <DetailField label="Description" value={m.expense_description} wrap />
                <DetailField label="Notes" value={m.notes} wrap />
                <DetailField
                  label="Rejection Reason"
                  value={m.rejection_reason}
                  wrap
                />
              </div>
            </div>
          ))}
        </div>
      </WbrDetailDialog>
    </V1Card>
  );
}
