"use client";

import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_BUCKETS,
  ATTENDANCE_BUCKET_LABELS,
  formatMinutes,
  parseAttendanceWarning,
} from "@/lib/maintenance-tickets/attendance-durations";
import type { AttendanceDurations, AttendanceMinutes } from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Paid time (net) — the server's own figures                               */
/*                                                                            */
/*  The per-section cells on the attendance card show a GROSS span: plain     */
/*  end-minus-start for each clock pair. This strip shows the server's NET    */
/*  figures, where break / travel / parts-run time falling inside the clock   */
/*  window is merged and subtracted once.                                    */
/*                                                                            */
/*  The two deliberately differ — a 09:00-17:00 shift with a 30-minute break  */
/*  is a span of 8h and paid time of 7h 30m. They are labelled "Span (gross)" */
/*  and "Paid time (net)" precisely so the pair reads as complementary rather */
/*  than contradictory.                                                      */
/*                                                                            */
/*  This ALWAYS renders the server's `durations`. The form's own preview      */
/*  (computeAttendancePreview) is never used here.                           */
/* ────────────────────────────────────────────────────────────────────────── */

function Bucket({
  label,
  minutes,
  hint,
}: {
  label: string;
  minutes: number;
  hint?: string;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {/* A recorded zero renders as a muted dash, not a dropped cell: a missing
          cell reads "not recorded", a dash reads "recorded as zero". */}
      <p
        className={cn(
          "text-[11px] tabular-nums",
          minutes > 0 ? "font-medium" : "text-muted-foreground"
        )}
      >
        {minutes > 0 ? formatMinutes(minutes) : "—"}
      </p>
      {hint && <p className="text-[9px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}

function WarningChip({ raw }: { raw: string }) {
  const w = parseAttendanceWarning(raw);
  return (
    <span
      // The exact code is always recoverable, even for an unknown one.
      title={w.raw}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        w.tone === "warn"
          ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
          : "border-border bg-muted text-muted-foreground"
      )}
    >
      {w.tone === "warn" ? (
        <AlertTriangle className="h-3 w-3 shrink-0" />
      ) : (
        <Info className="h-3 w-3 shrink-0" />
      )}
      {w.label}
    </span>
  );
}

interface AttendanceDurationsStripProps {
  /** Null on a pre-v2 record — the strip then renders nothing and only the
   *  per-section gross spans remain. */
  durations: AttendanceDurations | null;
  className?: string;
}

export function AttendanceDurationsStrip({
  durations,
  className,
}: AttendanceDurationsStripProps) {
  if (!durations) return null;

  const minutes: AttendanceMinutes = durations.minutes;

  return (
    <div className={cn("space-y-2 rounded-md border border-dashed bg-muted/40 p-2.5", className)}>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        Paid time (net)
      </p>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        {ATTENDANCE_BUCKETS.map((bucket) => (
          <Bucket
            key={bucket}
            label={ATTENDANCE_BUCKET_LABELS[bucket]}
            minutes={minutes[bucket]}
            hint={bucket === "work" ? "net of break, travel and parts run" : undefined}
          />
        ))}
      </div>

      {durations.warnings.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t pt-2">
          {durations.warnings.map((raw, i) => (
            <WarningChip key={`${raw}-${i}`} raw={raw} />
          ))}
        </div>
      )}
    </div>
  );
}
