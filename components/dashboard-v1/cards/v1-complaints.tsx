"use client";

import { useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import type { WbrComplaint } from "@/types/hooks.types";
import { fmtDate, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { WbrDetailDialog, DetailField } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1Empty } from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1ComplaintsCard — weekly complaints (quality), expandable when non-empty.
 *  Data shaping mirrors components/dspr/wbr-complaints-card.tsx.
 * ────────────────────────────────────────────────────────────────────────── */

export function V1ComplaintsCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: WbrComplaint[];
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data)
    return (
      <V1Card title="Complaints" category="quality" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const empty = data.length === 0;

  return (
      <V1Card
        title="Complaints"
        category="quality"
        period="W"
        span={span}
        className={className}
        onExpand={empty ? undefined : () => setOpen(true)}
      >
        {empty ? (
          <V1Empty icon={MessageSquareWarning}>No complaints this week</V1Empty>
        ) : (
          <div className="space-y-1.5">
            <V1Metric label="Complaints" value={data.length} size="sm" />
            {data.map((c) => (
              <div key={c.id} className="rounded-md bg-background/40 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-semibold">
                    {c.first_name} {c.last_name}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {fmtDate(c.complaint_date)}
                  </span>
                </div>
                <p className="line-clamp-2 text-[11px] text-muted-foreground">
                  {c.issue}
                </p>
              </div>
            ))}
          </div>
        )}
      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Complaints"
        badgeText={`${data.length} record${data.length === 1 ? "" : "s"}`}
      >
        <div className="space-y-3">
          {data.map((c) => (
            <div
              key={c.id}
              className="space-y-2 rounded-lg border bg-background/40 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {c.first_name} {c.last_name}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {fmtDate(c.complaint_date)}
                </span>
              </div>
              <div className="space-y-1.5">
                <DetailField label="Phone" value={c.phone} />
                <DetailField label="Email" value={c.email} />
                <DetailField label="Mgr Informed" value={c.manager_informed} />
                <DetailField label="Issue" value={c.issue} wrap />
                <DetailField label="Suggestion" value={c.suggestion} wrap />
              </div>
            </div>
          ))}
        </div>
      </WbrDetailDialog>
    </V1Card>
  );
}
