"use client";

import { useMemo, useState } from "react";
import type { DsprChannelSales } from "@/types/dspr.types";
import { V1Card } from "../v1-card";
import { V1Toggle, V1StackedBar, V1DataRow, type V1Segment } from "../v1-ui";
import { fmt$ } from "@/components/dspr/wbr-format";
import { CHANNELS, num } from "./channels";

/* Fresh take on the channel-mix donut: a single horizontal proportion bar
 * plus a ranked list of channels — denser and screenshot-friendly. */
export function V1ChannelMixCard({
  today,
  weekly,
  span,
  className,
}: {
  today: DsprChannelSales;
  weekly?: DsprChannelSales;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const hasWeekly = Boolean(weekly);
  const [view, setView] = useState<"day" | "wtd">("day");
  const active = view === "wtd" && weekly ? weekly : today;

  const { segments, total } = useMemo(() => {
    const segs: V1Segment[] = CHANNELS.map((c) => ({
      label: c.label,
      value: num(active[c.key]),
      color: c.color,
    }));
    const t = segs.reduce((s, x) => s + x.value, 0);
    return { segments: segs.sort((a, b) => b.value - a.value), total: t };
  }, [active]);

  return (
    <V1Card
      title="Sales by Channel"
      category="sales"
      period={hasWeekly ? "D·WTD" : "D"}
      span={span}
      className={className}
      headerControl={
        hasWeekly ? (
          <V1Toggle
            className="ms-1"
            options={[
              { value: "day", label: "Day" },
              { value: "wtd", label: "WTD" },
            ]}
            value={view}
            onChange={setView}
          />
        ) : undefined
      }
    >
      <div className="flex h-full flex-col gap-2 pt-1">
        <V1StackedBar segments={segments} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <V1DataRow
                key={s.label}
                label={
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                }
                value={fmt$(s.value)}
                trailing={
                  <span className="w-9 text-right text-[10px] font-normal text-muted-foreground">
                    {total > 0 ? `${((s.value / total) * 100).toFixed(0)}%` : "—"}
                  </span>
                }
              />
            ))}
        </div>
      </div>
    </V1Card>
  );
}
