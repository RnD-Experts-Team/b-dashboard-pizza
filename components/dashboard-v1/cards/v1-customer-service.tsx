"use client";

import { Users, Smile, DoorOpen, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNumD, fmtPct, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import type { CustomerService, CustomerServiceEntry } from "@/types/dashboard-report.types";
import { V1Card } from "../v1-card";
import { V1Empty } from "../v1-ui";

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

function StatBlock({
  icon: Icon,
  label,
  value,
  direction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  /** "up" = higher is better (green), "down" = higher is worse (red). */
  direction: "up" | "down";
}) {
  const good = direction === "up";
  return (
    <div className="flex flex-1 items-center gap-3 rounded-lg bg-background/55 px-3">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          good ? "bg-emerald-500/15 dark:bg-emerald-500/20" : "bg-red-500/15 dark:bg-red-500/20",
        )}
      >
        <Icon className={cn("h-4 w-4", good ? "text-emerald-500" : "text-red-500")} />
      </div>
      <p className="flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "shrink-0 text-xl font-bold tabular-nums leading-none",
          good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </p>
    </div>
  );
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
        <div className="flex h-full flex-col gap-1.5">
          <StatBlock
            icon={Smile}
            label="Guest Service"
            value={guestService != null ? fmtPct(guestService) : "—"}
            direction="up"
          />
          <StatBlock
            icon={DoorOpen}
            label="Lobby Points"
            value={lobbyPoints != null ? fmtNumD(lobbyPoints) : "—"}
            direction="down"
          />
          <StatBlock
            icon={Car}
            label="Drive-Thru Points"
            value={driveThruPoints != null ? fmtNumD(driveThruPoints) : "—"}
            direction="down"
          />
        </div>
      )}
    </V1Card>
  );
}
