"use client";

import { ClipboardList } from "lucide-react";
import { V1Empty, V1StackedBar } from "@/components/dashboard-v1/v1-ui";
import type {
  DebriefByTypeEntry,
  DebriefTrendByTypeEntry,
} from "@/types/employee-report.types";
import { LaborCard } from "./labor-chart";
import { fmtNumber } from "./labor-format";

/** Distinct hue per position in the list — cycles if there are ever more than 4 types. */
const SEGMENT_COLORS = ["#8b5cf6", "#f43f5e", "#0ea5e9", "#f59e0b", "#10b981", "#71717a"];

/**
 * `by_type` is an open catalog (`debrief_types` can grow upstream) — this
 * iterates whatever the API sends, including the always-present "untyped"
 * bucket, rather than assuming only the two known slugs exist.
 */
export function EmployeeReportBreakdown({
  byType,
  trailingAverages,
}: {
  byType: DebriefByTypeEntry[];
  /** `trend.averages.by_type` — may list fewer types than `byType` (e.g. no untyped bucket). */
  trailingAverages: DebriefTrendByTypeEntry[];
}) {
  const segments = byType
    .filter((e) => e.count > 0)
    .map((e, i) => ({
      label: `${e.type?.label ?? "Untyped"} (${e.count})`,
      value: e.count,
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    }));

  return (
    <LaborCard title="Debriefs by Type" icon={ClipboardList}>
      <div className="space-y-3">
        {segments.length === 0 ? (
          <V1Empty icon={ClipboardList}>No debriefs recorded this week</V1Empty>
        ) : (
          <V1StackedBar segments={segments} />
        )}

        {trailingAverages.length > 0 && (
          <div>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Trailing Weekly Average
            </p>
            {trailingAverages.map((a) => (
              <div
                key={a.type?.id ?? "untyped"}
                className="flex items-center justify-between gap-2 border-b border-border/40 py-1 last:border-0"
              >
                <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                  {a.type?.label ?? "Untyped"}
                </span>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums">
                  {fmtNumber(a.average_count, 2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </LaborCard>
  );
}
