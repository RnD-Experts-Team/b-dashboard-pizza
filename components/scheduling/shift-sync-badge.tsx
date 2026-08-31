"use client";

import { CloudOff, RefreshCw, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ShiftOrigin, ShiftSyncStatus } from "@/types/scheduling.types";

/**
 * Indicators for a shift's sync state and its origin.
 *
 * A `pending` or `parked` shift is REAL AND SAVED. It is simply not in Humanity
 * yet, so staff cannot see it. Never hide these shifts and never style them as
 * errors — the manager's work was not lost.
 *
 *   pending  usually resolves on its own (retries roughly every 6 hours, up to
 *            4 attempts), so a quiet indicator is enough.
 *   parked   will NEVER resolve without intervention. It deserves attention and
 *            an escalation path.
 */

const SYNC_COPY: Record<
  Exclude<ShiftSyncStatus, "synced">,
  { label: string; title: string; body: string }
> = {
  pending: {
    label: "Syncing",
    title: "Saved here, not yet in Humanity",
    body: "This shift is saved and will not be lost. It is waiting to reach Humanity, which usually happens on its own within a few hours. Staff cannot see it until then.",
  },
  parked: {
    label: "Not synced",
    title: "Needs attention — will not resolve on its own",
    body: "This shift is saved here but could not be sent to Humanity, and it will not retry again. The employee will never see it. Contact whoever runs the scheduling integration.",
  },
};

export function ShiftSyncIndicator({
  syncStatus,
  className,
}: {
  syncStatus: ShiftSyncStatus;
  className?: string;
}) {
  if (syncStatus === "synced") return null;
  const copy = SYNC_COPY[syncStatus];
  const isParked = syncStatus === "parked";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center", className)}>
          {isParked ? (
            <CloudOff className="h-2.5 w-2.5 text-rose-600 dark:text-rose-400" />
          ) : (
            <RefreshCw className="h-2.5 w-2.5 animate-spin text-sky-600 dark:text-sky-400" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 text-xs">
        <p className="font-semibold">{copy.title}</p>
        <p className="mt-0.5 opacity-90">{copy.body}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * A fuller badge for surfaces with room for one — the publish summary and the
 * bulk-operation result list rather than a dense grid cell.
 */
export function ShiftSyncBadge({ syncStatus }: { syncStatus: ShiftSyncStatus }) {
  if (syncStatus === "synced") return null;
  const copy = SYNC_COPY[syncStatus];
  const isParked = syncStatus === "parked";

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[10px]",
        isParked
          ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          : "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
      )}
    >
      {isParked ? (
        <CloudOff className="h-2.5 w-2.5" />
      ) : (
        <RefreshCw className="h-2.5 w-2.5" />
      )}
      {copy.label}
    </Badge>
  );
}

/**
 * Marks a shift that was last written in Humanity's own app rather than here.
 *
 * Worth surfacing subtly: it explains why an unfamiliar shift appeared, or why a
 * local edit was overwritten. Humanity always wins.
 */
export function ShiftOriginIndicator({
  origin,
  className,
}: {
  origin: ShiftOrigin;
  className?: string;
}) {
  if (origin === "operations") return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center", className)}>
          <Building2 className="h-2.5 w-2.5 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 text-xs">
        <p className="font-semibold">Changed in Humanity</p>
        <p className="mt-0.5 opacity-90">
          {origin === "reconciler"
            ? "This shift was reconciled from Humanity, not edited here."
            : "This shift was created or last changed in Humanity's own app."}{" "}
          Humanity is the source of truth for shifts, so its version wins.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
