"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────── */

export interface SpeedZone {
  /** Start value of this zone */
  from: number;
  /** End value of this zone */
  to: number;
  /** Color of the zone arc */
  color: string;
}

interface SpeedometerGaugeProps {
  /** Current value */
  value: number;
  /** Minimum scale value (default 0) */
  min?: number;
  /** Maximum scale value (default 100) */
  max?: number;
  /** Colored zones to render on the arc */
  zones: SpeedZone[];
  /** Status text (e.g. "On Target", "Critical") */
  statusLabel: string;
  /** Color for the status text */
  statusColor: string;
  /** Formatted display value (e.g. "21%") */
  valueDisplay: string;
  className?: string;
  /** Optional secondary metric to render as a second needle */
  secondaryValue?: number;
  /** Color for the secondary needle / legend */
  secondaryColor?: string;
  /** Short label for the secondary metric (shown in the legend) */
  secondaryLabel?: string;
}

/* ─── Layout constants ──────────────────────────────────────── */

const CX = 110;       // center X
const CY = 80;        // center Y
const R = 60;         // arc radius
const ARC_W = 9;      // arc stroke width
const START = 135;    // gauge start angle (SVG deg, bottom-left)
const SWEEP = 270;    // total sweep degrees
const NEEDLE = 46;    // needle length
const NEEDLE2 = 40;   // secondary needle length (slightly shorter)
// Default needle colors
const DEFAULT_PRIMARY_NEEDLE = "#DC2626"; // red
const DEFAULT_SECONDARY_NEEDLE = "#22C55E"; // green

/* ─── Geometry helpers ──────────────────────────────────────── */

const d2r = (d: number) => (d * Math.PI) / 180;

function polar(r: number, deg: number) {
  const rad = d2r(deg);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function arcPath(r: number, s: number, e: number) {
  const a = polar(r, s);
  const b = polar(r, e);
  const large = e - s > 180 ? 1 : 0;
  return [
    `M${a.x.toFixed(1)},${a.y.toFixed(1)}`,
    `A${r},${r} 0 ${large} 1 ${b.x.toFixed(1)},${b.y.toFixed(1)}`,
  ].join(" ");
}

/** Map a value to its SVG angle on the gauge arc */
function v2a(v: number, min: number, max: number) {
  const ratio = Math.max(0, Math.min(1, (v - min) / (max - min)));
  return START + ratio * SWEEP;
}

/* ─── Component ─────────────────────────────────────────────── */

export function SpeedometerGauge({
  value,
  min = 0,
  max = 100,
  zones,
  statusLabel,
  statusColor,
  valueDisplay,
  className,
  secondaryValue,
  secondaryColor,
  secondaryLabel,
}: SpeedometerGaugeProps) {
  const { resolvedTheme } = useTheme();
  // Animated internal value — always animate from 0 -> value on each change
  const [animValue, setAnimValue] = useState(0);

  const [animSecondary, setAnimSecondary] = useState<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const to = value;
    const duration = 900; // ms

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    function frame(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      setAnimValue(from + (to - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(frame);
      }
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  // Animate secondary needle separately when provided
  useEffect(() => {
    if (secondaryValue === undefined || secondaryValue === null) {
      setAnimSecondary(null);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const to = secondaryValue;
    const duration = 900;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    function frame(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      setAnimSecondary(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [secondaryValue]);

  const angle = useMemo(() => v2a(animValue, min, max), [animValue, min, max]);
  const tip = useMemo(() => polar(NEEDLE, angle), [angle]);
  const angle2 = useMemo(() => (animSecondary == null ? null : v2a(animSecondary, min, max)), [animSecondary, min, max]);
  const tip2 = useMemo(() => (angle2 == null ? null : polar(NEEDLE2, angle2)), [angle2]);
  
  // Value text color: white in dark mode, light gray in light mode for contrast
  const valueTextColor = resolvedTheme === "dark" ? "#ffffff" : "#747474";

  // Build zone arc paths
  const zoneArcs = useMemo(
    () =>
      zones.map((z) => ({
        d: arcPath(R, v2a(z.from, min, max), v2a(z.to, min, max)),
        color: z.color,
        key: `${z.from}-${z.to}`,
      })),
    [zones, min, max],
  );

  // Tick marks — 20 minor divisions, major every 5
  const ticks = useMemo(() => {
    const out: {
      x1: number; y1: number;
      x2: number; y2: number;
      major: boolean; key: number;
    }[] = [];
    for (let i = 0; i <= 20; i++) {
      const a = START + (i / 20) * SWEEP;
      const major = i % 5 === 0;
      const outerR = R - ARC_W / 2 - 2;
      const innerR = outerR - (major ? 8 : 4);
      const o = polar(outerR, a);
      const p = polar(innerR, a);
      out.push({ x1: p.x, y1: p.y, x2: o.x, y2: o.y, major, key: i });
    }
    return out;
  }, []);

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox="0 0 220 120" className="w-full h-auto">
        {/* Background track */}
        <path
          d={arcPath(R, START, START + SWEEP)}
          fill="none"
          stroke="currentColor"
          strokeWidth={ARC_W}
          className="text-muted/20"
          strokeLinecap="round"
        />

        {/* Colored zone arcs */}
        {zoneArcs.map((z) => (
          <path
            key={z.key}
            d={z.d}
            fill="none"
            stroke={z.color}
            strokeWidth={ARC_W}
            strokeLinecap="butt"
            opacity={0.85}
          />
        ))}

        {/* Tick marks */}
        {ticks.map((t) => (
          <line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="currentColor"
            strokeWidth={t.major ? 1.5 : 0.75}
            className="text-muted-foreground/40"
          />
        ))}

        {/* Primary Needle */}
        <line
          x1={CX}
          y1={CY}
          x2={tip.x}
          y2={tip.y}
          stroke={statusColor || DEFAULT_PRIMARY_NEEDLE}
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
        />

        {/* Secondary Needle (optional) */}
        {tip2 && (
          <line
            x1={CX}
            y1={CY}
            x2={tip2.x}
            y2={tip2.y}
            stroke={secondaryColor || DEFAULT_SECONDARY_NEEDLE}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="2 1"
            opacity={0.95}
          />
        )}

        {/* Center hub (neutral) */}
        <circle cx={CX} cy={CY} r={6} fill={statusColor || DEFAULT_PRIMARY_NEEDLE} opacity={0.95} />
        <circle cx={CX} cy={CY} r={3} fill="hsl(var(--background))" />

        {/* Value display — animate text during the initial needle animation */}
        <text
          x={CX}
          y={CY + 34}
          textAnchor="middle"
          fill={valueTextColor}
          fontSize="10"
          fontWeight="700"
          style={ { filter: "drop-shadow(0 0.5px 1px rgba(0,0,0,0.4))" }}
        >
          {(() => {
            const decimals = valueDisplay && valueDisplay.includes(".") ? 1 : 0;
            const suffix = valueDisplay && valueDisplay.includes("%") ? "%" : "";
            return `${animValue.toFixed(decimals)}${suffix}`;
          })()}
        </text>
      </svg>

      {/* Legend for primary/secondary (compact) */}
      {(secondaryLabel || angle2 != null) && (
        <div className="flex items-center justify-center gap-3 mt-1">
          <div className="flex items-center gap-1">
            {/* <span className="w-2 h-2 rounded-full" style={{ background: statusColor || DEFAULT_PRIMARY_NEEDLE }} /> */}
            {/* <span className="text-[10px] text-muted-foreground">{valueDisplay}</span> */}
          </div>
          {angle2 != null && (
            <div className="flex items-center gap-1">
              {/* <span className="w-2 h-2 rounded-full" style={{ background: secondaryColor || DEFAULT_SECONDARY_NEEDLE }} /> */}
              <span className="text-[10px] text-muted-foreground">{secondaryLabel ? `${secondaryLabel} ${(animSecondary ?? 0).toFixed(1)}${valueDisplay && valueDisplay.includes('%') ? '%' : ''}` : `${(animSecondary ?? 0).toFixed(1)}${valueDisplay && valueDisplay.includes('%') ? '% On Time' : ''}`}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
