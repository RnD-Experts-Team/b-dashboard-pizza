"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { ClipboardList, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import {
  V1DataRow,
  V1Empty,
  V1Metric,
  V1MetricGrid,
  V1StackedBar,
  V1SubLabel,
  type V1Segment,
} from "@/components/dashboard-v1/v1-ui";
import { fmtNum, fmtNumD } from "@/components/business-reports/report-format";
import type { IssueStatus, TicketsAnalytics, TicketsAnalyticsDuration } from "@/types/maintenance-tickets.types";
import { NO_VALUE } from "@/components/business-reports/cards/operations/br-shared";

const HOURS_PER_DAY = 24;

/** Literal hues for the proportion bar, matching the status pills (status-accent.ts). */
const STATUS_HEX: Record<IssueStatus, string> = {
  new: "#0ea5e9",
  in_review: "#6366f1",
  waiting_on_store: "#f59e0b",
  inspection: "#06b6d4",
  waiting_approval: "#d946ef",
  scheduled: "#8b5cf6",
  work_done: "#84cc16",
  closed: "#10b981",
  cancelled: "#a1a1aa",
};
const UNKNOWN_STATUS_HEX = "#94a3b8";

/** "5.2 h" under a day, "3.1 d" from a day up; "—" when there is nothing to average. */
function fmtHours(hours: number | null): string {
  if (hours === null) return NO_VALUE;
  return hours < HOURS_PER_DAY ? `${fmtNumD(hours)} h` : `${fmtNumD(hours / HOURS_PER_DAY)} d`;
}

function fmtCount(value: number | null): string {
  return value === null ? NO_VALUE : fmtNum(value);
}

function DurationRow({ label, d }: { label: string; d: TicketsAnalyticsDuration }) {
  return (
    <V1DataRow
      label={label}
      value={fmtHours(d.avgHours)}
      trailing={<span className="text-[9px] font-normal text-muted-foreground">n={fmtNum(d.sampleSize)}</span>}
    />
  );
}

/** Maintenance tickets opened in the range at the loaded stores. */
export function BrMaintenanceTicketsCard({ data }: { data: TicketsAnalytics }) {
  const locale = useLocale();
  const segments = useMemo<V1Segment[]>(
    () =>
      data.issues.statusBreakdown.map((b) => ({
        label: `${b.label} ${fmtNum(b.count)}`,
        value: b.count,
        color: STATUS_HEX[b.status] ?? UNKNOWN_STATUS_HEX,
      })),
    [data.issues.statusBreakdown],
  );
  const { overdue, stuck } = data.attention;
  const perWeek = data.avgTicketsPerWeek.value;

  return (
    <V1Card
      reportId="br-maintenance-tickets"
      title="Maintenance Tickets"
      category="quality"
      period="R"
      span={2}
      headerControl={
        <Button variant="ghost" size="icon" className="ms-1 h-5 w-5 shrink-0" asChild>
          <Link href={`/${locale}/dashboard/maintenance-tickets`} aria-label="Open maintenance tickets">
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {data.issues.total === 0 ? (
        <V1Empty icon={ClipboardList}>No tickets opened in this range.</V1Empty>
      ) : (
        <div className="space-y-2">
          <V1MetricGrid cols={4}>
            <V1Metric label="Opened" value={fmtNum(data.issues.total)} size="sm" />
            <V1Metric
              label="Overdue"
              value={fmtCount(overdue)}
              accent={overdue ? "text-red-600 dark:text-red-400" : undefined}
              size="sm"
            />
            <V1Metric
              label="Stuck"
              value={fmtCount(stuck)}
              accent={stuck ? "text-amber-600 dark:text-amber-400" : undefined}
              size="sm"
            />
            <V1Metric label="Avg / Week" value={perWeek === null ? NO_VALUE : fmtNumD(perWeek)} size="sm" />
          </V1MetricGrid>
          <div>
            <V1SubLabel className="mb-1">Status</V1SubLabel>
            <V1StackedBar segments={segments} />
          </div>
          <div>
            <V1SubLabel className="mb-0.5">Average durations</V1SubLabel>
            <DurationRow label="Pending → next status" d={data.durations.pendingToNextStatus} />
            <DurationRow label="To complete / cancel" d={data.durations.timeToCompleteOrCancelled} />
          </div>
        </div>
      )}
    </V1Card>
  );
}
