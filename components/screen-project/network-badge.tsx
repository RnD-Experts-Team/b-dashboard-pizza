import { cn } from "@/lib/utils";
import type { NetworkStatus } from "@/lib/hooks/use-network-status";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Signal level helpers                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

type SignalLevel = 0 | 1 | 2 | 3 | 4;

function getSignalLevel(status: NetworkStatus): SignalLevel {
  if (!status.online) return 0;
  const { connectionQuality: q, downlink, rtt, effectiveType } = status;

  // LiveKit quality is measured from actual WebRTC stats — highest accuracy for video
  if (q === "lost") return 0;
  if (q === "poor")  return 1;
  if (q === "good" || q === "excellent") {
    const base: SignalLevel = q === "excellent" ? 4 : 3;
    // Demote one step if rtt or downlink suggests congestion despite reported quality
    if ((rtt !== undefined && rtt > 300) || (downlink !== undefined && downlink < 2)) {
      return (base - 1) as SignalLevel;
    }
    return base;
  }

  // No LiveKit quality — score from Network Information API
  const rttLevel: SignalLevel =
    rtt === undefined ? 4 :
    rtt > 500 ? 1 :
    rtt > 250 ? 2 :
    rtt > 100 ? 3 : 4;

  const dlLevel: SignalLevel =
    downlink === undefined ? 4 :
    downlink < 0.5 ? 1 :
    downlink < 2   ? 2 :
    downlink < 10  ? 3 : 4;

  if (downlink !== undefined || rtt !== undefined) {
    return Math.max(1, Math.min(rttLevel, dlLevel)) as SignalLevel;
  }

  // Last resort: effectiveType
  switch (effectiveType) {
    case "slow-2g": return 1;
    case "2g":      return 2;
    case "3g":      return 3;
    case "4g":
    default:        return 4;
  }
}

function getLabel(status: NetworkStatus): string {
  if (!status.online) return "Offline";
  const { connectionQuality: q, downlink, rtt, effectiveType } = status;

  if (q === "lost") return "Lost";
  if (q === "poor") return "Poor";
  if (q === "good" || q === "excellent") {
    if ((rtt !== undefined && rtt > 300) || (downlink !== undefined && downlink < 2)) return "Fair";
    return q === "excellent" ? "Excellent" : "Good";
  }

  if (downlink !== undefined) {
    return downlink >= 1
      ? `${downlink % 1 === 0 ? downlink : downlink.toFixed(1)} Mbps`
      : `${Math.round(downlink * 1000)} Kbps`;
  }

  switch (effectiveType) {
    case "slow-2g": return "Slow 2G";
    case "2g":      return "2G";
    case "3g":      return "3G";
    case "4g":      return "4G";
    default:        return "Online";
  }
}

/** Return the Tailwind colour class for active bars at a given level. */
function activeColour(level: SignalLevel): string {
  switch (level) {
    case 0: return "fill-muted-foreground/30";
    case 1: return "fill-red-500";
    case 2: return "fill-orange-400";
    case 3: return "fill-amber-400";
    case 4: return "fill-emerald-500";
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SignalBars — 4 bottom-aligned bars, SVG                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

const BARS: { x: number; height: number; y: number }[] = [
  { x: 0,  height: 3,  y: 9 },
  { x: 4,  height: 6,  y: 6 },
  { x: 8,  height: 9,  y: 3 },
  { x: 12, height: 12, y: 0 },
];

interface SignalBarsProps {
  level: SignalLevel;
  className?: string;
}

function SignalBars({ level, className }: SignalBarsProps) {
  const active = activeColour(level);
  return (
    <svg
      viewBox="0 0 15 12"
      width="15"
      height="12"
      aria-hidden="true"
      className={className}
    >
      {BARS.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={bar.y}
          width={3}
          height={bar.height}
          rx={1}
          className={
            i < level
              ? active
              : "fill-muted-foreground/25"
          }
        />
      ))}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  NetworkBadge                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

interface NetworkBadgeProps {
  status: NetworkStatus;
  /** Hide the text label, show bars only */
  iconOnly?: boolean;
  className?: string;
}

export function NetworkBadge({ status, iconOnly = false, className }: NetworkBadgeProps) {
  const level = getSignalLevel(status);
  const label = getLabel(status);

  const badgeColour = {
    0: "border-destructive/30 bg-destructive/10 text-destructive",
    1: "border-red-500/30 bg-red-500/10 text-red-500",
    2: "border-orange-400/30 bg-orange-400/10 text-orange-500 dark:text-orange-400",
    3: "border-amber-400/30 bg-amber-400/10 text-amber-600 dark:text-amber-400",
    4: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  }[level];

  const parts: string[] = [label];
  if (status.downlink !== undefined) parts.push(`${status.downlink.toFixed(1)} Mbps`);
  if (status.rtt !== undefined) parts.push(`${status.rtt}ms RTT`);
  const tooltip = status.online ? parts.join(" · ") : "No internet connection";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
        badgeColour,
        className,
      )}
      title={tooltip}
      aria-label={status.online ? `Internet: ${tooltip}` : "No internet connection"}
    >
      <SignalBars level={level} />
      {!iconOnly && (
        <span className="hidden sm:inline leading-none">{label}</span>
      )}
    </div>
  );
}
