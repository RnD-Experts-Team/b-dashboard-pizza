"use client";

import { cn } from "@/lib/utils";
import { Users, Smile, DoorOpen, Car } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerService, CustomerServiceEntry } from "@/types/dashboard-report.types";
import { fmtDate, fmtNumD, fmtPct, WbrCardSkeleton } from "./wbr-format";

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
      <p className="flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "shrink-0 text-2xl font-bold tabular-nums leading-none",
          good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function WbrCustomerServiceCard({
  data,
  isLoading,
  className,
}: {
  data?: CustomerService;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const { filtering, entries } = data;
  const guestService = average(entries, "guest_service");
  const lobbyPoints = average(entries, "lobby_points");
  const driveThruPoints = average(entries, "drive_thru_points");

  return (
    <Card
      className={cn(
        "flex h-[280px] flex-col gap-0 py-1.5 bg-linear-to-r from-cyan-50 via-cyan-100 to-cyan-200 dark:from-cyan-950/20 dark:via-cyan-900/40 dark:to-cyan-800/50",
        className,
      )}
    >
      <CardHeader className="shrink-0 px-3 pb-1">
        <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
          <div className="rounded bg-cyan-500/15 p-0.5 dark:bg-cyan-500/20">
            <Users className="h-3 w-3 text-cyan-500" />
          </div>
          Customer Service
          <span className="ml-auto font-normal text-muted-foreground">
            {fmtDate(filtering.week_start)} → {fmtDate(filtering.week_end)}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 px-3 pb-2">
        {entries.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 py-4 text-center">
            <Users className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground">No customer service data this period.</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-2">
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
      </CardContent>
    </Card>
  );
}
