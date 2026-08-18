"use client";

import { ClipboardList, MessageSquareWarning, Repeat, UserCog, Users } from "lucide-react";
import type {
  EmployeeReportHeadcount,
  EmployeeReportSummary,
} from "@/types/employee-report.types";
import { SummaryTile } from "./labor-chart";
import { DASH, fmtNumber } from "./labor-format";

/** Trailing averages are null only for a store with no debrief data at all. */
const NO_DATA_YET = "No data yet";

export function EmployeeReportSummaryStrip({
  summary,
  headcount,
}: {
  summary: EmployeeReportSummary;
  headcount: EmployeeReportHeadcount;
}) {
  const hasDebriefs = summary.total_debriefs_this_week > 0;

  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
      {/* People currently on staff — same "home" color as the Labor summary strip. */}
      <SummaryTile
        label="Active Employees"
        value={fmtNumber(summary.active_employees)}
        icon={Users}
        color="text-violet-600 dark:text-violet-400"
        iconBg="bg-violet-500/15 dark:bg-violet-500/20"
        borderColor="border-l-violet-500"
        tooltip="Employees currently assigned to this store (a roster snapshot, not activity this week)"
      />

      {/* The rest of the roster snapshot — total headcount ever tied to this store. */}
      <SummaryTile
        label="Total Roster"
        value={fmtNumber(headcount.total)}
        caption={`· ${fmtNumber(headcount.inactive)} inactive`}
        icon={UserCog}
        color="text-muted-foreground"
        iconBg="bg-muted"
        borderColor="border-l-border"
        tooltip="Every employee ever tied to this store, active and inactive"
      />

      {/* Debrief volume — rose only when there's actually something logged. */}
      <SummaryTile
        label="Debriefs"
        value={fmtNumber(summary.total_debriefs_this_week)}
        caption="· this week"
        icon={MessageSquareWarning}
        color={hasDebriefs ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}
        iconBg={hasDebriefs ? "bg-rose-500/15 dark:bg-rose-500/20" : "bg-muted"}
        borderColor={hasDebriefs ? "border-l-rose-500" : "border-l-border"}
        isNegative={hasDebriefs}
        tooltip="Total employee debriefs (manager notes) logged this week"
      />

      {/* Most common type — the shape of the week's debrief activity. */}
      <SummaryTile
        label="Most Common"
        value={summary.most_common_type_this_week?.label ?? DASH}
        icon={ClipboardList}
        color="text-orange-600 dark:text-orange-400"
        iconBg="bg-orange-500/15 dark:bg-orange-500/20"
        borderColor="border-l-orange-500"
        tooltip="The debrief type logged most often this week"
      />

      {/* Trailing baseline — blue, same "informational" tone as pay/hours tiles. */}
      <SummaryTile
        label="Avg Weekly"
        value={
          summary.avg_weekly_debriefs_trailing === null
            ? NO_DATA_YET
            : fmtNumber(summary.avg_weekly_debriefs_trailing, 1)
        }
        caption={summary.avg_weekly_debriefs_trailing === null ? undefined : "· trailing avg"}
        icon={Repeat}
        color="text-blue-600 dark:text-blue-400"
        iconBg="bg-blue-500/15 dark:bg-blue-500/20"
        borderColor="border-l-blue-500"
        tooltip="Average debriefs per week over the trailing window"
      />
    </div>
  );
}
