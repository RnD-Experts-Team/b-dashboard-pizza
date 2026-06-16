"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { HandCoins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WbrMoneyOwed } from "@/types/hooks.types";
import { fmt$2, fmtDate, WbrCardSkeleton } from "./wbr-format";
import { WbrDetailDialog, DetailField } from "./wbr-detail-dialog";

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

export function WbrMoneyOwedCard({
  data,
  isLoading,
  className,
}: {
  data?: WbrMoneyOwed[];
  isLoading?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const empty = data.length === 0;

  return (
    <>
      <Card
        onClick={() => !empty && setOpen(true)}
        className={cn(
          "flex h-[280px] flex-col gap-0 py-1.5 transition-shadow bg-linear-to-r from-lime-50 via-lime-100 to-lime-200 dark:from-lime-950/20 dark:via-lime-900/40 dark:to-lime-800/50",
          !empty && "cursor-pointer hover:shadow-md",
          className,
        )}
      >
        <CardHeader className="shrink-0 px-3 pb-1">
          <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
            <div className="rounded bg-lime-500/15 p-0.5 dark:bg-lime-600/20">
              <HandCoins className="h-3 w-3 text-lime-600" />
            </div>
            Money Owed
            <Badge
              variant="secondary"
              className={cn(
                "ml-auto h-4 px-1.5 py-0 text-[10px]",
                data.length > 0
                  ? "bg-lime-500/15 text-lime-700 dark:text-lime-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {data.length}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-2">
          {empty ? (
            <p className="py-2 text-[11px] text-muted-foreground">
              No reimbursements this week.
            </p>
          ) : (
            data.map((m) => (
              <div key={m.id} className="rounded-md bg-background/40 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold">
                    {m.employee_full_name}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums">
                    {money(m.expenses_amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {fmtDate(m.expense_date)}
                  </span>
                  <ApproveBadge value={m.approve} />
                </div>
                {m.expense_description && (
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">
                    {m.expense_description}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

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
                <DetailField label="Approved" value={<ApproveBadge value={m.approve} />} />
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
    </>
  );
}
