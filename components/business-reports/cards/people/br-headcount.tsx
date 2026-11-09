"use client";

import { useMemo } from "react";
import { ArrowRight, UsersRound } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { fmtNumber } from "@/components/labor/labor-format";
import { ApexChart, useChartTheme } from "@/components/business-reports/chart";
import { cn } from "@/lib/utils";
import type { LaborReport } from "@/types/business-reports.types";
import { TALL_ROW_HEIGHT, peopleBarOptions } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Headcount — active employees at the start vs end of the range, hires and
 *  separations, and the end-of-range mix by position (all loaded stores).
 * ────────────────────────────────────────────────────────────────────────── */

const BAR_ROW_PX = 22;
const MIN_CHART_PX = 120;

export function BrHeadcount({ data }: { data: LaborReport }) {
  const theme = useChartTheme();
  const h = data.combined.headcount;
  const positions = h.by_position;
  // Net is the real change in active employees (end − start), the same as the
  // Labor Summary. Hires − separations misses people who moved between the
  // selected stores and these, or changed status without a hire/separation —
  // that difference is shown as "Other moves".
  const net = h.active_end - h.active_start;
  const otherMoves = net - (h.new_hires - h.separations);

  const options = useMemo(
    () => peopleBarOptions(theme, positions.map((p) => p.position || "Unassigned"), (v) => fmtNumber(v), true),
    [theme, positions],
  );
  const series = useMemo(() => [{ name: "Employees", data: positions.map((p) => p.count) }], [positions]);
  const chartHeight = Math.max(MIN_CHART_PX, positions.length * BAR_ROW_PX);

  return (
    <V1Card reportId="br-headcount" title="Headcount" category="people" period="R" span={1} height={TALL_ROW_HEIGHT}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border/50 bg-background/55 px-2 py-1.5">
          <div className="text-center">
            <p className="text-[9px] font-medium text-muted-foreground">Start</p>
            <p className="text-lg font-bold tabular-nums">{fmtNumber(h.active_start)}</p>
          </div>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="text-center">
            <p className="text-[9px] font-medium text-muted-foreground">End</p>
            <p className="text-lg font-bold tabular-nums">{fmtNumber(h.active_end)}</p>
          </div>
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
              net > 0 && "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
              net < 0 && "bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
              net === 0 && "bg-muted text-muted-foreground",
            )}
            title="Active employees at the end minus at the start"
          >
            {net > 0 ? "+" : ""}
            {fmtNumber(net)} net
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <V1Metric label="New Hires" value={`+${fmtNumber(h.new_hires)}`} size="sm" />
          <V1Metric label="Separations" value={`−${fmtNumber(h.separations)}`} size="sm" />
          <V1Metric label="Other Moves" value={`${otherMoves > 0 ? "+" : ""}${fmtNumber(otherMoves)}`} size="sm" />
        </div>

        <V1SubLabel>By Position · end of range</V1SubLabel>
        {positions.length === 0 ? (
          <V1Empty icon={UsersRound}>No active employees</V1Empty>
        ) : (
          <ApexChart key={theme.key} options={options} series={series} type="bar" height={chartHeight} />
        )}
      </div>
    </V1Card>
  );
}
