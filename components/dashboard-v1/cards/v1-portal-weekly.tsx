"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  PortalWeekly,
  PortalWeeklyRow,
} from "@/types/dashboard-report.types";
import { fmtPct, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Toggle, V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1PortalWeeklyCard — multi-week Portal % / HNR % with point-change deltas.
 *  Data shaping mirrors components/dspr/wbr-portal-weekly-card.tsx.
 * ────────────────────────────────────────────────────────────────────────── */

function shortRange(r: PortalWeeklyRow): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const fmt = (d: string) => {
    const [, m, day] = d.split("-");
    return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}`;
  };
  return `${fmt(r.week_start)} – ${fmt(r.week_end)}`;
}

/** Point change (curr − prev) rendered as "+1.5pp" with sign colouring. */
function PpDelta({ curr, prev }: { curr: number; prev?: number }) {
  if (prev === undefined) return <span className="text-muted-foreground">—</span>;
  const d = curr - prev;
  if (Math.abs(d) < 0.05) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "tabular-nums",
        d > 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
      )}
    >
      {d > 0 ? "+" : ""}
      {d.toFixed(1)}pp
    </span>
  );
}

export function V1PortalWeeklyCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: PortalWeekly;
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [itemsMode, setItemsMode] = useState<"all" | "special">("all");
  // Independent from the card's own toggle — switching one does not affect the other.
  const [dialogItemsMode, setDialogItemsMode] = useState<"all" | "special">("all");
  if (isLoading)
    return (
      <div className={["col-span-1 md:col-span-1 lg:col-span-2", className].filter(Boolean).join(" ")}>
        <WbrCardSkeleton />
      </div>
    );
  if (!data)
    return (
      <V1Card title="Portal & HNR Weekly" category="operations" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  // Latest week first.
  const weeks = [...data.weeks].sort((a, b) =>
    b.week_start.localeCompare(a.week_start),
  );
  const currentWeekStart = data.filtering.week_start;

  return (
      <V1Card
        title="Portal & HNR Weekly"
        category="operations"
        period="W"
        span={span}
        className={className}
        headerNote={`${weeks.length} wks`}
        onExpand={() => setOpen(true)}
        bodyClassName="px-0"
        headerControl={
          <V1Toggle
            className="ms-1"
            options={[
              { value: "all", label: "All" },
              { value: "special", label: "Special" },
            ]}
            value={itemsMode}
            onChange={setItemsMode}
          />
        }
      >
        <table className={V1_TBL}>
          <thead>
            <tr>
              <th className={V1_TH}>Week</th>
              <th className={cn(V1_TH, V1_NUM)}>Portal %</th>
              <th className={cn(V1_TH, V1_NUM)}>HNR %</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, i) => {
              const prev = weeks[i + 1];
              const isCurrent = w.week_start === currentWeekStart;
              const hnrSource = itemsMode === "special" ? w.important_items_hnr : w;
              const prevHnrSource = itemsMode === "special" ? prev?.important_items_hnr : prev;
              return (
                <tr key={w.week_start} className={cn(isCurrent && "font-semibold")}>
                  <td className={V1_TD}>{shortRange(w)}</td>
                  <td className={cn(V1_TD, V1_NUM)}>
                    {fmtPct(w.in_portal_on_time_percent)}{" "}
                    <span className="text-[10px]">
                      <PpDelta
                        curr={w.in_portal_on_time_percent}
                        prev={prev?.in_portal_on_time_percent}
                      />
                    </span>
                  </td>
                  <td className={cn(V1_TD, V1_NUM)}>
                    {hnrSource ? (
                      <>
                        {fmtPct(hnrSource.hnr_promise_met_percent)}{" "}
                        <span className="text-[10px]">
                          <PpDelta
                            curr={hnrSource.hnr_promise_met_percent}
                            prev={prevHnrSource?.hnr_promise_met_percent}
                          />
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Portal & HNR — Weekly History"
        badgeText={`${weeks.length} weeks`}
      >
        <div className="mb-3 flex justify-end">
          <V1Toggle
            options={[
              { value: "all", label: "All" },
              { value: "special", label: "Special" },
            ]}
            value={dialogItemsMode}
            onChange={setDialogItemsMode}
          />
        </div>
        <table className={V1_TBL}>
          <thead>
            <tr>
              <th className={V1_TH}>Week</th>
              <th className={cn(V1_TH, V1_NUM)}>Eligible</th>
              <th className={cn(V1_TH, V1_NUM)}>Used</th>
              <th className={cn(V1_TH, V1_NUM)}>On-Time</th>
              <th className={cn(V1_TH, V1_NUM)}>Portal %</th>
              <th className={cn(V1_TH, V1_NUM)}>Δ</th>
              <th className={cn(V1_TH, V1_NUM)}>HNR Txns</th>
              <th className={cn(V1_TH, V1_NUM)}>Broken</th>
              <th className={cn(V1_TH, V1_NUM)}>Met</th>
              <th className={cn(V1_TH, V1_NUM)}>HNR %</th>
              <th className={cn(V1_TH, V1_NUM)}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, i) => {
              const prev = weeks[i + 1];
              const isCurrent = w.week_start === currentWeekStart;
              const hnr = dialogItemsMode === "special" ? w.important_items_hnr : w;
              const prevHnr = dialogItemsMode === "special" ? prev?.important_items_hnr : prev;
              return (
                <tr key={w.week_start} className={cn(isCurrent && "font-semibold")}>
                  <td className={cn(V1_TD, "whitespace-nowrap")}>{shortRange(w)}</td>
                  <td className={cn(V1_TD, V1_NUM)}>{w.portal_eligible_orders}</td>
                  <td className={cn(V1_TD, V1_NUM)}>{w.portal_used_orders}</td>
                  <td className={cn(V1_TD, V1_NUM)}>{w.portal_on_time_orders}</td>
                  <td className={cn(V1_TD, V1_NUM)}>{fmtPct(w.in_portal_on_time_percent)}</td>
                  <td className={cn(V1_TD, V1_NUM)}>
                    <PpDelta
                      curr={w.in_portal_on_time_percent}
                      prev={prev?.in_portal_on_time_percent}
                    />
                  </td>
                  {hnr ? (
                    <>
                      <td className={cn(V1_TD, V1_NUM)}>{hnr.hnr_transactions}</td>
                      <td className={cn(V1_TD, V1_NUM)}>{hnr.hnr_broken_promises}</td>
                      <td className={cn(V1_TD, V1_NUM)}>{hnr.hnr_promise_met}</td>
                      <td className={cn(V1_TD, V1_NUM)}>{fmtPct(hnr.hnr_promise_met_percent)}</td>
                      <td className={cn(V1_TD, V1_NUM)}>
                        <PpDelta
                          curr={hnr.hnr_promise_met_percent}
                          prev={prevHnr?.hnr_promise_met_percent}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={cn(V1_TD, V1_NUM)}>
                        <span className="text-muted-foreground">—</span>
                      </td>
                      <td className={cn(V1_TD, V1_NUM)}>
                        <span className="text-muted-foreground">—</span>
                      </td>
                      <td className={cn(V1_TD, V1_NUM)}>
                        <span className="text-muted-foreground">—</span>
                      </td>
                      <td className={cn(V1_TD, V1_NUM)}>
                        <span className="text-muted-foreground">—</span>
                      </td>
                      <td className={cn(V1_TD, V1_NUM)}>
                        <span className="text-muted-foreground">—</span>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Δ compares each week to the prior week. Portal % = in-portal on-time;
          HNR % = promise met{dialogItemsMode === "special" ? " (Special Items)" : ""}.
        </p>
      </WbrDetailDialog>
    </V1Card>
  );
}
