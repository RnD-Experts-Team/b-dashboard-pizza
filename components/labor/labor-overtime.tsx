"use client";

import { useMemo } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  V1Empty,
  V1Metric,
  V1_TBL,
  V1_TD,
  V1_TH,
  V1_NUM,
} from "@/components/dashboard-v1/v1-ui";
import { cn } from "@/lib/utils";
import type { LaborOvertime as LaborOvertimeData } from "@/types/labor.types";
import { LaborCard } from "./labor-chart";
import { fmtHours, fmtNumber } from "./labor-format";

export function LaborOvertime({ overtime }: { overtime: LaborOvertimeData }) {
  // Thresholds come from the response — never hardcode 40/60.
  const t40 = overtime.over_40_hours_threshold;
  const t60 = overtime.over_60_hours_threshold;

  // over_60_hours is always a subset, so nest it as a badge rather than
  // repeating the same people in a second table.
  const over60Ids = useMemo(
    () => new Set(overtime.over_60_hours.map((e) => e.employee_id)),
    [overtime.over_60_hours],
  );

  const rows = overtime.over_40_hours;

  return (
    <LaborCard title="Overtime" icon={Clock}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1">
          <V1Metric
            label={`Over ${t40} Hours`}
            value={fmtNumber(overtime.over_40_hours_count)}
            size="lg"
          />
          <V1Metric
            label={`Over ${t60} Hours`}
            value={fmtNumber(overtime.over_60_hours_count)}
            size="lg"
            accent={
              overtime.over_60_hours_count > 0
                ? "text-rose-600 dark:text-rose-400"
                : undefined
            }
          />
        </div>

        {rows.length === 0 ? (
          <V1Empty icon={Clock}>No one worked over {t40} hours this week</V1Empty>
        ) : (
          <div className="max-h-72 overflow-auto contain-layout rounded-md border border-border/50">
            <table className={V1_TBL}>
              <thead>
                <tr>
                  <th className={V1_TH}>Employee</th>
                  <th className={V1_TH}>Position</th>
                  <th className={cn(V1_TH, "text-right")}>Hours</th>
                  <th className={cn(V1_TH, "text-right")}>OT</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const isOver60 = over60Ids.has(e.employee_id);
                  return (
                    <tr
                      key={e.employee_id}
                      className={cn(
                        "hover:bg-muted/40",
                        isOver60 && "bg-rose-500/5",
                      )}
                    >
                      <td className={cn(V1_TD, "font-medium")}>
                        <span className="flex items-center gap-1.5">
                          <span className="truncate">
                            {e.name ?? `Employee #${e.employee_id}`}
                          </span>
                          {isOver60 && (
                            <Badge className="h-4 shrink-0 border-rose-500/40 bg-rose-500/15 px-1 text-[9px] font-semibold text-rose-700 hover:bg-rose-500/20 dark:text-rose-300">
                              {t60}h+
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className={cn(V1_TD, "text-muted-foreground")}>
                        {e.position ?? "—"}
                      </td>
                      <td className={cn(V1_TD, V1_NUM, "font-semibold")}>
                        {fmtHours(e.total_hours)}
                      </td>
                      <td className={cn(V1_TD, V1_NUM, "font-semibold")}>
                        {fmtHours(e.overtime_hours)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </LaborCard>
  );
}
