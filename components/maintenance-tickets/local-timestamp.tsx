"use client";

import { cn } from "@/lib/utils";
import { formatLocalTimestamp } from "@/lib/utils/date-display";

/**
 * A timestamp in the viewer's clock that says which clock that is.
 *
 *   Oct 6, 2026 · 2:03 PM  (your time, GMT-4)
 *
 * The API speaks UTC; this shows device time — the convention everywhere else
 * in the dashboard — but labels it, so nobody wonders whether 2:03 PM is the
 * store's time, UTC or theirs. Hovering shows the zone's name and the UTC
 * instant. Renders the raw input if it cannot be parsed, never a blank.
 */
export function LocalTimestamp({
  iso,
  pattern,
  showZone = true,
  className,
}: {
  iso: string;
  pattern?: string;
  /** Hide the "(your time, …)" suffix when a nearby one already says it. */
  showZone?: boolean;
  className?: string;
}) {
  const ts = formatLocalTimestamp(iso, pattern);

  if (!ts) {
    return <span className={className}>{iso}</span>;
  }

  const title = [ts.zoneName && `Your time zone: ${ts.zoneName}`, ts.utc].filter(Boolean).join(" · ");

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1", className)}>
      <time dateTime={iso} title={title} className="tabular-nums">
        {ts.text}
      </time>
      {showZone && (
        <span className="text-[11px] text-muted-foreground" title={title}>
          (your time, {ts.zone})
        </span>
      )}
    </span>
  );
}
