"use client";

import { useState } from "react";
import { SpeedometerGauge, type SpeedZone } from "@/components/dspr/speedometer-gauge";
import {
  WtdComparisonDialog,
  ComparisonTable,
} from "@/components/dspr/wtd-comparison-dialog";
import type { DsprHnr } from "@/types/dspr.types";
import { CheckCircle2, XCircle, Timer } from "lucide-react";
import { V1Card } from "../v1-card";
import { V1Toggle, V1Metric, V1MetricGrid } from "../v1-ui";
import { fmtNum } from "@/components/dspr/wbr-format";

/* HNR meter zones (mirrors the existing HNR card). */
const HNR_ZONES: SpeedZone[] = [
  { from: 0, to: 60, color: "#EF4444" },
  { from: 60, to: 70, color: "#EAB308" },
  { from: 70, to: 90, color: "#F97316" },
  { from: 90, to: 100, color: "#22C55E" },
];

function hnrLabel(v: number): string {
  if (v <= 35) return "Critical Low";
  if (v <= 42) return "Low";
  if (v <= 50) return "Below Target";
  if (v <= 70) return "On Target";
  if (v <= 77) return "Above Target";
  if (v <= 85) return "High";
  return "Critical High";
}

export function V1HnrCard({
  hnr,
  weeklyHnr,
  weeklyAvgHnr,
  span,
  className,
}: {
  hnr: DsprHnr;
  weeklyHnr?: DsprHnr;
  weeklyAvgHnr?: DsprHnr;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const hasWeekly = Boolean(weeklyHnr);
  const [view, setView] = useState<"day" | "wtd">("day");
  const [open, setOpen] = useState(false);
  const active = view === "wtd" && weeklyHnr ? weeklyHnr : hnr;
  const pct = active.hnr_promise_met_percent;

  return (
      <V1Card
        title="Hot-N-Ready"
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
              value={pct}
              max={100}
              zones={HNR_ZONES}
              statusLabel={hnrLabel(pct)}
              statusColor="#DC2626"
              valueDisplay={`${pct.toFixed(1)}%`}
            />
          </div>
          {/* spacer matches Portal's legend row height so grids align */}
          <div className="h-4 shrink-0" />
          <V1MetricGrid cols={3}>
            <V1Metric size="sm" label="Trans." value={fmtNum(active.hnr_transactions)} />
            <V1Metric
              size="sm"
              label="Kept"
              accent="text-emerald-600 dark:text-emerald-400"
              value={
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {fmtNum(active.hnr_promise_met)}
                </span>
              }
            />
            <V1Metric
              size="sm"
              label="Broken"
              accent={active.hnr_broken_promises > 0 ? "text-red-600 dark:text-red-400" : undefined}
              value={
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {fmtNum(active.hnr_broken_promises)}
                </span>
              }
            />
          </V1MetricGrid>
        </div>
      {weeklyHnr && (() => {
        const avg = weeklyAvgHnr ?? weeklyHnr;
        return (
          <WtdComparisonDialog open={open} onClose={() => setOpen(false)} title="Hot-N-Ready — Day vs Week-to-Date">
            <ComparisonTable
              rows={[
                { label: "Promise Met %", daily: `${hnr.hnr_promise_met_percent.toFixed(1)}%`, wtd: `${avg.hnr_promise_met_percent.toFixed(1)}%`, dailyNum: hnr.hnr_promise_met_percent, wtdNum: avg.hnr_promise_met_percent, higherIsBetter: true },
                { label: "Transactions", daily: `${hnr.hnr_transactions}`, wtd: `${avg.hnr_transactions}`, dailyNum: hnr.hnr_transactions, wtdNum: avg.hnr_transactions, higherIsBetter: true },
                { label: "Promises Kept", daily: `${hnr.hnr_promise_met}`, wtd: `${avg.hnr_promise_met}`, dailyNum: hnr.hnr_promise_met, wtdNum: avg.hnr_promise_met, higherIsBetter: true },
                { label: "Broken Promises", daily: `${hnr.hnr_broken_promises}`, wtd: `${avg.hnr_broken_promises}`, dailyNum: hnr.hnr_broken_promises, wtdNum: avg.hnr_broken_promises, higherIsBetter: false },
              ]}
            />
          </WtdComparisonDialog>
        );
      })()}
    </V1Card>
  );
}
