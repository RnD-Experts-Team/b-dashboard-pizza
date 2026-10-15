"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ApexOptions } from "apexcharts";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART_INK, USAGE_COLORS, formatDuration } from "@/lib/screen-usage/format";
import type { UsageTimelineSegment } from "@/lib/screen-usage/types";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full" />,
});

type Lane = "session" | "main" | "camera" | "mic" | "talkAll";
type State = "page" | "pip" | "main" | "visible" | "noFace" | "covered" | "open" | "dead" | "talkAll";

const LANES: Lane[] = ["session", "main", "camera", "mic", "talkAll"];

const STATE_COLORS: Record<State, string> = {
  page: USAGE_COLORS.info,
  pip: "#7c3aed",
  main: "#0891b2",
  visible: USAGE_COLORS.good,
  noFace: USAGE_COLORS.attention,
  covered: USAGE_COLORS.problem,
  open: USAGE_COLORS.good,
  dead: USAGE_COLORS.problem,
  talkAll: "#7c3aed",
};

function laneOf(s: UsageTimelineSegment): { lane: Lane; state: State } {
  switch (s.kind) {
    case "session":
      return { lane: "session", state: s.surface === "pip" ? "pip" : "page" };
    case "main":
      return { lane: "main", state: "main" };
    case "camera":
      return { lane: "camera", state: s.state === "covered" ? "covered" : s.state === "no_face" ? "noFace" : "visible" };
    case "mic":
      return { lane: "mic", state: s.state === "dead" ? "dead" : "open" };
    default:
      return { lane: "talkAll", state: "talkAll" };
  }
}

/** One manager, one day (viewer's clock): every lane minute by minute; kicks are marked. */
export function DayTimeline({
  segments,
  dayStart,
  dayEnd,
}: {
  segments: UsageTimelineSegment[];
  dayStart: number;
  dayEnd: number;
}) {
  const t = useTranslations("screenMonitoring");

  const { series, options } = useMemo(() => {
    const bars = segments
      .map((s) => {
        const start = Math.max(Date.parse(s.started_at), dayStart);
        const end = Math.min(Date.parse(s.ended_at), dayEnd);
        return end > start ? { ...laneOf(s), start, end, s } : null;
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);

    const kicks = segments
      .filter((s) => s.kind === "session" && s.end_reason === "duplicate_identity")
      .map((s) => Date.parse(s.ended_at))
      .filter((at) => at >= dayStart && at <= dayEnd);

    // One series per state, so the legend explains every colour.
    const states = [...new Set(bars.map((b) => b.state))];
    const ser = states.map((state) => ({
      name: t(`states.${state}`),
      color: STATE_COLORS[state],
      data: bars
        .filter((b) => b.state === state)
        .map((b) => ({
          x: t(`lanes.${b.lane}`),
          y: [b.start, b.end],
          meta: [b.s.store, b.s.station, b.s.talking_seconds > 0 ? t("talkingFor", { duration: formatDuration(b.s.talking_seconds) }) : ""]
            .filter(Boolean)
            .join(" · "),
        })),
    }));

    const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const opts: ApexOptions = {
      chart: { type: "rangeBar", toolbar: { show: true, tools: { download: false } }, zoom: { enabled: true }, fontFamily: "inherit", animations: { enabled: false } },
      plotOptions: { bar: { horizontal: true, barHeight: "55%", rangeBarGroupRows: true } },
      xaxis: { type: "datetime", min: dayStart, max: dayEnd, labels: { datetimeUTC: false, format: "HH:mm" } },
      yaxis: { categories: LANES.map((l) => t(`lanes.${l}`)) } as ApexOptions["yaxis"],
      legend: { position: "top", horizontalAlign: "left", fontSize: "12px" },
      grid: { strokeDashArray: 0 },
      annotations: {
        xaxis: kicks.map((x) => ({
          x,
          borderColor: USAGE_COLORS.problem,
          label: { text: t("kicked"), style: { background: USAGE_COLORS.problem, color: "#fff" } },
        })),
      },
      tooltip: {
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const point = w.config.series[seriesIndex].data[dataPointIndex];
          const [start, end] = point.y as [number, number];
          const div = document.createElement("div");
          div.className = "px-2 py-1 text-xs";
          div.textContent = `${w.config.series[seriesIndex].name}: ${time(start)} – ${time(end)} (${formatDuration((end - start) / 1000)})${point.meta ? ` · ${point.meta}` : ""}`;
          return div.outerHTML;
        },
      },
    };
    return { series: ser, options: opts };
  }, [segments, dayStart, dayEnd, t]);

  if (series.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("dayEmpty")}</p>;
  }
  return (
    <figure className={CHART_INK}>
      <ReactApexChart type="rangeBar" height={300} series={series} options={options} />
    </figure>
  );
}
