"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { shirtMilestoneService } from "@/lib/api/services/shirt-milestone.service";
import {
  SHIRT_STATUS_LABELS,
  formatInstant,
  formatPlainDate,
  milestoneMonthLabel,
  shirtEmployeeName,
} from "@/lib/shirts/shirt-utils";
import { ShirtPreview } from "@/components/shirts/shirt-preview";
import { ShirtEmptyState, ShirtStatusBadge } from "@/components/shirts/shirt-ui";
import type {
  ShirtHistoryResponse,
  ShirtMilestoneStatus,
} from "@/types/shirt-milestone.types";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

export interface ShirtHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Store NUMBER. */
  storeNumber: string;
  employeeId: number | null;
  employeeName?: string;
}

/** Screen 4 — every shirt an employee has been through, newest first. */
export function ShirtHistoryDialog({
  open,
  onOpenChange,
  storeNumber,
  employeeId,
  employeeName,
}: ShirtHistoryDialogProps) {
  const [data, setData] = useState<ShirtHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || employeeId === null || !storeNumber) return;

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setData(null);

    shirtMilestoneService
      .getEmployeeHistory(storeNumber, employeeId, controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (axios.isCancel(err)) return;
        setError("Could not load this employee's shirt history.");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [open, storeNumber, employeeId]);

  const summary = data?.summary;
  // Both are null when the employee is not currently employed — "0 months"
  // would be a lie, so say what is actually true.
  const notEmployed = summary
    ? summary.current_stint_start_date === null &&
      summary.months_with_company_current_stint === null
    : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Shirt History</DialogTitle>
          <DialogDescription>
            {data ? shirtEmployeeName(data.employee) : (employeeName ?? "")}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {data && summary && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="Delivered" value={String(summary.total_delivered)} />
              <StatTile label="Milestones" value={String(summary.total_milestones)} />
              <StatTile
                label="This stint"
                value={
                  notEmployed
                    ? "—"
                    : `${summary.months_with_company_current_stint ?? 0} mo`
                }
              />
              <StatTile
                label="Last delivered"
                value={
                  summary.last_delivered_at
                    ? formatInstant(summary.last_delivered_at, "MMM d, yyyy")
                    : "—"
                }
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {notEmployed
                ? "Not currently employed."
                : `Current stint started ${formatPlainDate(summary.current_stint_start_date)}.`}
            </p>

            {/* All five keys are always present, so no null-checking needed. */}
            <div className="flex flex-wrap gap-2">
              {(
                Object.keys(summary.by_status) as ShirtMilestoneStatus[]
              ).map((status) => (
                <Badge key={status} variant="outline">
                  {SHIRT_STATUS_LABELS[status]}: {summary.by_status[status]}
                </Badge>
              ))}
            </div>

            {data.milestones.length === 0 ? (
              <ShirtEmptyState>No shirt milestones yet.</ShirtEmptyState>
            ) : (
              <ScrollArea className="max-h-80 rounded-lg border">
                <div className="divide-y">
                  {data.milestones.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3">
                      <div className="w-14 shrink-0">
                        {/* Every milestone carries its own colour/logo/template
                            snapshot, so re-rendering a past shirt needs no fetch. */}
                        <ShirtPreview
                          template={m.shirt_template}
                          color={m.shirt_color}
                          logo={m.shirt_logo}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {milestoneMonthLabel(m.milestone_month)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.shirt_color?.name ?? "—"}
                          {m.t_shirt_size ? ` · ${m.t_shirt_size}` : ""}
                          {m.delivered_at
                            ? ` · delivered ${formatInstant(m.delivered_at, "MMM d, yyyy")}`
                            : m.delivery_date
                              ? ` · due ${formatPlainDate(m.delivery_date)}`
                              : ""}
                        </p>
                      </div>
                      <ShirtStatusBadge status={m.status} />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
