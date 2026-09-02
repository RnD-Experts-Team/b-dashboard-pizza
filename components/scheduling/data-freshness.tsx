"use client";

import { useEffect, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * "Updated 2 min ago" beside the refresh button.
 *
 * The week is served from a short-lived cache, so what is on screen may be a
 * few minutes old. Stating the age turns that from something the manager might
 * discover the hard way into something they can see before they trust a number.
 *
 * Owns its own ticker rather than deriving the age in the parent. The parent is
 * the whole scheduling grid; re-rendering it every 30 seconds to advance a
 * two-word label would be a poor trade. It therefore takes a *timestamp*, which
 * is stable across renders, and computes the age itself.
 */

interface DataFreshnessProps {
  /** Epoch ms of the fetch behind the data on screen; null when not cached. */
  lastFetchedAt: number | null;
  isRefreshing: boolean;
  className?: string;
}

/** Re-render often enough that "just now" does not linger into minutes. */
const TICK_MS = 30_000;

function relativeLabel(lastFetchedAt: number): string {
  const mins = Math.floor((Date.now() - lastFetchedAt) / 60_000);
  if (mins < 1) return "Updated just now";
  if (mins === 1) return "Updated 1 min ago";
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return `Updated ${hours} hr${hours === 1 ? "" : "s"} ago`;
}

export function DataFreshness({
  lastFetchedAt,
  isRefreshing,
  className,
}: DataFreshnessProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (lastFetchedAt === null) return;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [lastFetchedAt]);

  if (isRefreshing) {
    return (
      <span className={cn("text-[11px] text-muted-foreground", className)}>
        Refreshing…
      </span>
    );
  }
  if (lastFetchedAt === null) return null;

  const exact = new Date(lastFetchedAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "cursor-default whitespace-nowrap text-[11px] tabular-nums text-muted-foreground",
            className,
          )}
        >
          {relativeLabel(lastFetchedAt)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p>Last fetched at {exact}</p>
        <p className="opacity-80">
          Refreshes automatically once it is more than 5 minutes old.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
