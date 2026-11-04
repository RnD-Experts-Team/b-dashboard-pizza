/**
 * Screen Project monitoring — number formatting. The report speaks seconds.
 */

/** "3h 05m", "42m", "<1m", "0m". */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return seconds > 0 ? "<1m" : "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h.toLocaleString()}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Seconds → hours with one decimal, for chart values. */
export function toHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10;
}

/** "62%", or "—" when there is nothing to divide by. */
export function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

/** Share as a 0–100 number (0 when undefined), for sorting and bars. */
export function share(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/**
 * Chart colours, validated with the dataviz checks (lightness band, CVD
 * separation, ≥ 3:1 contrast on both card surfaces). Fixed meaning, never
 * cycled: good = teal, needs attention = amber, problem = red, nothing = grey.
 */
export const USAGE_COLORS = {
  good: "#0d9488",
  attention: "#d97706",
  problem: "#dc2626",
  info: "#2563eb",
  off: "#94a3b8",
  /** Open hours nobody was connected for: lighter than "off", which is time connected with the device off. */
  gap: "#cbd5e1",
} as const;

/** Chart text, grid and tooltip in the page's own colours, whatever the theme (same as the maintenance analytics charts). */
export const CHART_INK = [
  "[&_.apexcharts-text]:fill-muted-foreground",
  "[&_.apexcharts-yaxis-label]:fill-foreground",
  "[&_.apexcharts-datalabel]:fill-foreground",
  "[&_.apexcharts-legend-text]:!text-muted-foreground",
  "[&_.apexcharts-gridline]:stroke-border",
  "[&_.apexcharts-tooltip]:!border-border [&_.apexcharts-tooltip]:!bg-popover [&_.apexcharts-tooltip]:!text-popover-foreground [&_.apexcharts-tooltip]:!shadow-md",
  "[&_.apexcharts-tooltip-title]:!border-border [&_.apexcharts-tooltip-title]:!bg-muted",
].join(" ");
