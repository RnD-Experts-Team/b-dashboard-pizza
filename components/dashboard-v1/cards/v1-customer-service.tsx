"use client";

import { Users } from "lucide-react";
import { fmtNumD, fmtPct, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import type { CustomerService, CustomerServiceEntry } from "@/types/dashboard-report.types";
import { V1Card } from "../v1-card";
import { V1Empty, V1MetricGrid, V1Metric } from "../v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1CustomerServiceCard — Dashboard V1, category "quality", period "W".
 * ────────────────────────────────────────────────────────────────────────── */

/** Mean of a field across entries, skipping nulls. null when every entry is null. */
function average(
  entries: CustomerServiceEntry[],
  field: "guest_service" | "lobby_points" | "drive_thru_points",
): number | null {
  const values = entries.map((e) => e[field]).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function V1CustomerServiceCard({
  data,
  isLoading,
  span = 1,
  className,
}: {
  data?: CustomerService;
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const { entries } = data;
  const guestService = average(entries, "guest_service");
  const lobbyPoints = average(entries, "lobby_points");
  const driveThruPoints = average(entries, "drive_thru_points");

  return (
    <V1Card title="Customer Service" category="quality" period="W" span={span} className={className}>
      {entries.length === 0 ? (
        <V1Empty icon={Users}>No customer service data this period.</V1Empty>
      ) : (
        <V1MetricGrid cols={3}>
          <V1Metric
            size="sm"
            label="Guest Service"
            value={guestService != null ? fmtPct(guestService) : "—"}
            accent="text-cyan-600 dark:text-cyan-400"
          />
          <V1Metric
            size="sm"
            label="Lobby Points"
            value={lobbyPoints != null ? fmtNumD(lobbyPoints) : "—"}
          />
          <V1Metric
            size="sm"
            label="Drive-Thru"
            value={driveThruPoints != null ? fmtNumD(driveThruPoints) : "—"}
          />
        </V1MetricGrid>
      )}
    </V1Card>
  );
}
