"use client";

import { useState } from "react";
import { SpeedometerGauge } from "@/components/dspr/speedometer-gauge";
import {
  PERFORMANCE_ZONES,
  getPerformanceLabel,
} from "@/components/dspr/portal-meter-utils";
import {
  WtdComparisonDialog,
  ComparisonGrid,
  ComparisonTable,
} from "@/components/dspr/wtd-comparison-dialog";
import type { DsprPortal } from "@/types/dspr.types";
import { V1Card } from "../v1-card";
import { V1Toggle, V1Metric, V1MetricGrid } from "../v1-ui";
import { fmtNum } from "@/components/dspr/wbr-format";

export function V1PortalGaugeCard({
  portal,
  span,
  className,
}: {
  portal: DsprPortal;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const weekly = portal.week_to_date_avg;
  const hasWeekly = Boolean(weekly);
  const [view, setView] = useState<"day" | "wtd">("day");
  const [open, setOpen] = useState(false);
  const active = view === "wtd" && weekly ? weekly : portal;
  const primary = active.put_into_portal_percent;
  const secondary = active.in_portal_on_time_percent;

  return (
      <V1Card
        title="Portal Performance"
        category="operations"
        period={hasWeekly ? "D·WTD" : "D"}
        span={span}
        className={className}
        bodyClassName="overflow-hidden"
        onExpand={hasWeekly ? () => setOpen(true) : undefined}
        headerControl={
          hasWeekly ? (
            <V1Toggle
              className="ms-1"
              options={[
                { value: "day", label: "Day" },
                { value: "wtd", label: "WTD" },
              ]}
              value={view}
              onChange={setView}
            />
          ) : undefined
        }
      >
        <div className="flex flex-col gap-1">
          <div className="mx-auto w-full max-w-[260px]">
            <SpeedometerGauge
              value={primary}
              secondaryValue={secondary}
              secondaryColor="#22C55E"
              secondaryLabel=""
              zones={PERFORMANCE_ZONES}
              statusLabel={getPerformanceLabel(primary)}
              statusColor="#DC2626"
              valueDisplay={`${primary.toFixed(1)}%`}
            />
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="flex items-center gap-1 text-[8px] font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Put Into Portal
            </span>
            <span className="flex items-center gap-1 text-[8px] font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> On Time
            </span>
          </div>
          <V1MetricGrid cols={3}>
            <V1Metric size="sm" label="Eligible" value={fmtNum(active.portal_eligible_orders)} />
            <V1Metric size="sm" label="Used" value={fmtNum(active.portal_used_orders)} />
            <V1Metric size="sm" label="On Time" value={fmtNum(active.portal_on_time_orders)} />
          </V1MetricGrid>
        </div>
      {weekly && (
        <WtdComparisonDialog open={open} onClose={() => setOpen(false)} title="Portal Performance Comparison">
          <ComparisonGrid
            daily={
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Put Into Portal %</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                    {portal.put_into_portal_percent.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">On-Time %</p>
                  <p className="text-xl font-bold text-emerald-600 tabular-nums">
                    {portal.in_portal_on_time_percent.toFixed(1)}%
                  </p>
                </div>
              </div>
            }
            wtd={
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Put Into Portal %</p>
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {weekly.put_into_portal_percent.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">On-Time %</p>
                  <p className="text-xl font-bold text-emerald-600 tabular-nums">
                    {weekly.in_portal_on_time_percent.toFixed(1)}%
                  </p>
                </div>
              </div>
            }
          />
          <ComparisonTable
            rows={[
              { label: "Put Into Portal %", daily: `${portal.put_into_portal_percent.toFixed(1)}%`, wtd: `${weekly.put_into_portal_percent.toFixed(1)}%`, dailyNum: portal.put_into_portal_percent, wtdNum: weekly.put_into_portal_percent, higherIsBetter: true },
              { label: "On-Time %", daily: `${portal.in_portal_on_time_percent.toFixed(1)}%`, wtd: `${weekly.in_portal_on_time_percent.toFixed(1)}%`, dailyNum: portal.in_portal_on_time_percent, wtdNum: weekly.in_portal_on_time_percent, higherIsBetter: true },
              { label: "Eligible Orders", daily: `${portal.portal_eligible_orders}`, wtd: `${weekly.portal_eligible_orders}`, dailyNum: portal.portal_eligible_orders, wtdNum: weekly.portal_eligible_orders, higherIsBetter: true },
              { label: "Used Orders", daily: `${portal.portal_used_orders}`, wtd: `${weekly.portal_used_orders}`, dailyNum: portal.portal_used_orders, wtdNum: weekly.portal_used_orders, higherIsBetter: true },
              { label: "On-Time Orders", daily: `${portal.portal_on_time_orders}`, wtd: `${weekly.portal_on_time_orders}`, dailyNum: portal.portal_on_time_orders, wtdNum: weekly.portal_on_time_orders, higherIsBetter: true },
            ]}
          />
        </WtdComparisonDialog>
      )}
    </V1Card>
  );
}
