"use client";

import { useState } from "react";
import { SpeedometerGauge, type SpeedZone } from "@/components/dspr/speedometer-gauge";
import {
  WtdComparisonDialog,
  ComparisonTable,
} from "@/components/dspr/wtd-comparison-dialog";
import { V1Card } from "../v1-card";
import { V1Toggle } from "../v1-ui";

/* Labor zones — symmetric around the 19–24% green target (0–50 scale). */
const LABOR_ZONES: SpeedZone[] = [
  { from: 0, to: 10, color: "#EF4444" },
  { from: 10, to: 15, color: "#EAB308" },
  { from: 15, to: 19, color: "#F97316" },
  { from: 19, to: 24, color: "#22C55E" },
  { from: 24, to: 29, color: "#F97316" },
  { from: 29, to: 39, color: "#EAB308" },
  { from: 39, to: 50, color: "#EF4444" },
];

function laborLabel(v: number): string {
  if (v <= 10) return "Critical Low";
  if (v <= 15) return "Low";
  if (v <= 19) return "Below Target";
  if (v <= 24) return "On Target";
  if (v <= 29) return "Above Target";
  if (v <= 39) return "High";
  return "Critical High";
}

export function V1LaborCard({
  value,
  weeklyValue,
  weeklyAvgValue,
  span,
  className,
}: {
  value: number;
  weeklyValue?: number;
  weeklyAvgValue?: number;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const hasWeekly = weeklyValue !== undefined;
  const [view, setView] = useState<"day" | "wtd">("day");
  const [open, setOpen] = useState(false);
  const active = view === "wtd" && hasWeekly ? weeklyValue! : value;

  return (
      <V1Card
        title="Labor"
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
        <div className="flex flex-col">
          <div className="mx-auto w-full max-w-[260px]">
            <SpeedometerGauge
              value={active}
              max={50}
              zones={LABOR_ZONES}
              statusLabel={laborLabel(active)}
              statusColor="#DC2626"
              valueDisplay={`${active.toFixed(1)}%`}
            />
          </div>
          <p className="text-center text-[9px] font-medium text-muted-foreground">
            Target range:{" "}
            <span className="font-semibold text-emerald-500">19–24%</span>
          </p>
        </div>
      {hasWeekly && (
        <WtdComparisonDialog open={open} onClose={() => setOpen(false)} title="Labor — Day vs Week-to-Date">
          <ComparisonTable
            rows={[
              {
                label: "Labor %",
                daily: `${value.toFixed(1)}%`,
                wtd: `${weeklyValue!.toFixed(1)}%`,
                dailyNum: value,
                wtdNum: weeklyValue!,
                higherIsBetter: false,
              },
              ...(weeklyAvgValue !== undefined
                ? [
                    {
                      label: "WTD Daily Avg",
                      daily: "—",
                      wtd: `${weeklyAvgValue.toFixed(1)}%`,
                      higherIsBetter: false,
                    },
                  ]
                : []),
            ]}
          />
        </WtdComparisonDialog>
      )}
    </V1Card>
  );
}
