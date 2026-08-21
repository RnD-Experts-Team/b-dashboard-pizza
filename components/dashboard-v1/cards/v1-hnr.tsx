"use client";

import { useState } from "react";
import { SpeedometerGauge, type SpeedZone } from "@/components/dspr/speedometer-gauge";
import {
  WtdComparisonDialog,
  ComparisonGrid,
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
  importantItemsHnr,
  weeklyImportantItemsHnr,
  weeklyAvgImportantItemsHnr,
  span,
  className,
}: {
  hnr: DsprHnr;
  weeklyHnr?: DsprHnr;
  weeklyAvgHnr?: DsprHnr;
  importantItemsHnr?: DsprHnr;
  weeklyImportantItemsHnr?: DsprHnr;
  weeklyAvgImportantItemsHnr?: DsprHnr;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  // "Has any weekly data at all" — checks every sum/avg field across both
  // item scopes, so the toggle never hides just because one sibling field
  // happens to be missing.
  const hasWeekly = Boolean(weeklyHnr || weeklyAvgHnr || weeklyImportantItemsHnr || weeklyAvgImportantItemsHnr);
  const hasSpecialItems = Boolean(importantItemsHnr);
  const [view, setView] = useState<"day" | "wtd">("day");
  const [itemsMode, setItemsMode] = useState<"all" | "special">("all");
  const [open, setOpen] = useState(false);
  // Independent from the card's own All/Special toggle — switching one does not affect the other.
  const [dialogItemsMode, setDialogItemsMode] = useState<"all" | "special">("all");
  // WTD rankings come two ways — a running sum, or averaged per day.
  const [wtdMode, setWtdMode] = useState<"sum" | "avg">("sum");

  const source =
    itemsMode === "special"
      ? {
          day: importantItemsHnr ?? hnr,
          wtd: weeklyImportantItemsHnr,
          wtdAvg: weeklyAvgImportantItemsHnr,
        }
      : { day: hnr, wtd: weeklyHnr, wtdAvg: weeklyAvgHnr };
  const useAvg = wtdMode === "avg";
  const hasAvgData = Boolean(source.wtdAvg);
  // True only when avg data actually exists for the current item scope — if the
  // user picked "avg" then switched All/Special to a scope without avg data,
  // this correctly falls back to sum without still claiming to show "Avg".
  const showingAvg = useAvg && hasAvgData;
  const active = view === "wtd" && source.wtd ? (showingAvg ? source.wtdAvg! : source.wtd) : source.day;
  const pct = active.hnr_promise_met_percent;

  return (
      <V1Card
        title="Hot-N-Ready"
        category="operations"
        period={hasWeekly ? "D·WTD" : "D"}
        showPeriodBadge={false}
        span={span}
        className={className}
        bodyClassName="overflow-hidden"
        onExpand={() => setOpen(true)}
        headerControl={
          <div className="ms-1 flex flex-wrap items-center gap-0.5">
            {hasSpecialItems && (
              <V1Toggle
                options={[
                  { value: "all", label: "All" },
                  { value: "special", label: "Special" },
                ]}
                value={itemsMode}
                onChange={setItemsMode}
              />
            )}
            <V1Toggle
              options={[
                { value: "day", label: "Day" },
                { value: "wtd", label: "WTD" },
              ]}
              value={view}
              onChange={setView}
            />
            {view === "wtd" && (
              <V1Toggle
                options={[
                  { value: "sum", label: "Sum" },
                  { value: "avg", label: "Avg" },
                ]}
                value={wtdMode}
                onChange={setWtdMode}
              />
            )}
          </div>
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
      {(() => {
        const dailyHnr = dialogItemsMode === "special" ? importantItemsHnr ?? hnr : hnr;
        // Special items never fall back to all-items weekly data — doing so
        // would silently compare a genuine special-items daily figure against
        // store-wide WTD numbers while still labeled "Special Items".
        const sumHnr = dialogItemsMode === "special" ? weeklyImportantItemsHnr : weeklyHnr;
        const avgSource =
          dialogItemsMode === "special"
            ? weeklyAvgImportantItemsHnr ?? weeklyImportantItemsHnr
            : weeklyAvgHnr ?? weeklyHnr;
        const itemsToggle = hasSpecialItems && (
          <div className="mb-3 flex justify-end">
            <V1Toggle
              options={[
                { value: "all", label: "All Items" },
                { value: "special", label: "Special Items" },
              ]}
              value={dialogItemsMode}
              onChange={setDialogItemsMode}
            />
          </div>
        );

        // Dialog is always available — even scoped to "Special Items" with no
        // weekly data at all, it shows a clear "no data" message rather than
        // silently substituting All Items' numbers under the Special label.
        if (!sumHnr && !avgSource) {
          return (
            <WtdComparisonDialog
              open={open}
              onClose={() => setOpen(false)}
              title="Hot-N-Ready Comparison"
              badgeText={`${dialogItemsMode === "special" ? "Special Items" : "All Items"} · Daily vs WTD`}
            >
              {itemsToggle}
              <p className="py-8 text-center text-[11px] text-muted-foreground">
                No WTD data available for {dialogItemsMode === "special" ? "Special Items" : "All Items"}.
              </p>
            </WtdComparisonDialog>
          );
        }

        const avg = avgSource ?? sumHnr!;
        const sumHnrResolved = sumHnr ?? avgSource!;
        const showSum = Boolean(avgSource && sumHnr && avgSource !== sumHnr);
        return (
          <WtdComparisonDialog
            open={open}
            onClose={() => setOpen(false)}
            title="Hot-N-Ready Comparison"
            badgeText={`${dialogItemsMode === "special" ? "Special Items" : "All Items"} · Daily vs WTD${showSum ? " Avg" : ""}`}
          >
            {itemsToggle}
            <ComparisonGrid
              daily={
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                    {dailyHnr.hnr_promise_met_percent.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Promise Met</p>
                  <div className="flex gap-3 mt-2">
                    <span className="text-[11px]">Trans: <b>{dailyHnr.hnr_transactions}</b></span>
                    <span className="text-[11px]">Kept: <b>{dailyHnr.hnr_promise_met}</b></span>
                    <span className="text-[11px]">Broken: <b>{dailyHnr.hnr_broken_promises}</b></span>
                  </div>
                </div>
              }
              wtd={
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {avg.hnr_promise_met_percent.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Promise Met{showSum ? " (Avg)" : ""}</p>
                  <div className="flex gap-3 mt-2">
                    <span className="text-[11px]">Trans: <b>{avg.hnr_transactions}</b></span>
                    <span className="text-[11px]">Kept: <b>{avg.hnr_promise_met}</b></span>
                    <span className="text-[11px]">Broken: <b>{avg.hnr_broken_promises}</b></span>
                  </div>
                </div>
              }
            />
            <ComparisonTable
              rows={[
                { label: "Promise Met %", daily: `${dailyHnr.hnr_promise_met_percent.toFixed(1)}%`, wtd: `${avg.hnr_promise_met_percent.toFixed(1)}%`, dailyNum: dailyHnr.hnr_promise_met_percent, wtdNum: avg.hnr_promise_met_percent, higherIsBetter: true, wtdSum: showSum ? `${sumHnrResolved.hnr_promise_met_percent.toFixed(1)}%` : undefined },
                { label: "Transactions", daily: `${dailyHnr.hnr_transactions}`, wtd: `${avg.hnr_transactions}`, dailyNum: dailyHnr.hnr_transactions, wtdNum: avg.hnr_transactions, higherIsBetter: true, wtdSum: showSum ? `${sumHnrResolved.hnr_transactions}` : undefined },
                { label: "Promises Kept", daily: `${dailyHnr.hnr_promise_met}`, wtd: `${avg.hnr_promise_met}`, dailyNum: dailyHnr.hnr_promise_met, wtdNum: avg.hnr_promise_met, higherIsBetter: true, wtdSum: showSum ? `${sumHnrResolved.hnr_promise_met}` : undefined },
                { label: "Broken Promises", daily: `${dailyHnr.hnr_broken_promises}`, wtd: `${avg.hnr_broken_promises}`, dailyNum: dailyHnr.hnr_broken_promises, wtdNum: avg.hnr_broken_promises, higherIsBetter: false, wtdSum: showSum ? `${sumHnrResolved.hnr_broken_promises}` : undefined },
              ]}
            />
          </WtdComparisonDialog>
        );
      })()}
    </V1Card>
  );
}
