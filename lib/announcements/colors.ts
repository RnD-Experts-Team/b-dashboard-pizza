import type { CSSProperties } from "react";

/**
 * Accent colours for announcements: a solid colour (`color_start` alone) or a
 * gradient (`color_start` + `color_end`). `color_end` without `color_start` is
 * a 422 on the server, so the client refuses it first (`pairRule`).
 */

/* ────────────────────────────────────────────────────────────────────────── */
/*  Hex                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

const HEX_6 = /^#[0-9a-f]{6}$/i;
const HEX_3 = /^#[0-9a-f]{3}$/i;

/** "#fff" and "#ffffff" are both valid input. */
export function isHex(value: string | null | undefined): value is string {
  return !!value && (HEX_6.test(value.trim()) || HEX_3.test(value.trim()));
}

/**
 * The form the server stores: lowercase, six digits, leading "#". Accepts
 * "ff6b6b", "#FF6B6B" and "#f6b"; returns null for anything that isn't a hex
 * colour.
 */
export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value.trim().toLowerCase();
  if (!v.startsWith("#")) v = `#${v}`;
  if (HEX_3.test(v)) {
    v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return HEX_6.test(v) ? v : null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Presets                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export interface AccentPreset {
  /** Stable id; i18n labels hang off it (`announcements.colors.<id>`). */
  id: string;
  /** English name, used until the translation exists. */
  label: string;
  start: string;
  /** null = a solid colour. */
  end: string | null;
}

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  // Gradients
  { id: "sunset", label: "Sunset", start: "#f97316", end: "#ec4899" },
  { id: "ocean", label: "Ocean", start: "#0ea5e9", end: "#6366f1" },
  { id: "mint", label: "Mint", start: "#10b981", end: "#06b6d4" },
  { id: "berry", label: "Berry", start: "#db2777", end: "#7c3aed" },
  { id: "gold", label: "Gold", start: "#f59e0b", end: "#ef4444" },
  { id: "aurora", label: "Aurora", start: "#22d3ee", end: "#a78bfa" },
  { id: "meadow", label: "Meadow", start: "#84cc16", end: "#10b981" },
  // Solids
  { id: "red", label: "Red", start: "#ef4444", end: null },
  { id: "blue", label: "Blue", start: "#3b82f6", end: null },
  { id: "green", label: "Green", start: "#22c55e", end: null },
  { id: "amber", label: "Amber", start: "#f59e0b", end: null },
  { id: "violet", label: "Violet", start: "#8b5cf6", end: null },
];

/* ────────────────────────────────────────────────────────────────────────── */
/*  The accent of an announcement                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export type Accent =
  | { kind: "none"; start: null; end: null; cssVars: CSSProperties }
  | { kind: "solid"; start: string; end: null; cssVars: CSSProperties }
  | { kind: "gradient"; start: string; end: string; cssVars: CSSProperties };

/** `--ann-start` / `--ann-end`, read by the `.ann-ring` / `.ann-title-gradient` CSS. */
function cssVarsFor(start: string, end: string): CSSProperties {
  return { "--ann-start": start, "--ann-end": end } as CSSProperties;
}

/**
 * What to draw for an announcement's colour fields. Invalid or half-given
 * values are treated as no accent rather than guessed at.
 */
export function accentOf(a: {
  color_start?: string | null;
  color_end?: string | null;
}): Accent {
  const start = normalizeHex(a.color_start);
  const end = normalizeHex(a.color_end);
  if (!start) return { kind: "none", start: null, end: null, cssVars: {} };
  if (!end || end === start) {
    return { kind: "solid", start, end: null, cssVars: cssVarsFor(start, start) };
  }
  return { kind: "gradient", start, end, cssVars: cssVarsFor(start, end) };
}

/**
 * The rule the server enforces: an end colour needs a start colour.
 * "endNeedsStart" means the form must not be submitted as it stands.
 */
export function pairRule(
  start: string | null | undefined,
  end: string | null | undefined,
): "ok" | "endNeedsStart" {
  return end && !start ? "endNeedsStart" : "ok";
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Contrast                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on `hex` (for a tick on a swatch). */
export function readableOn(hex: string): "#000000" | "#ffffff" {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#000000";
  return contrastRatio(rgb, { r: 255, g: 255, b: 255 }) >=
    contrastRatio(rgb, { r: 0, g: 0, b: 0 })
    ? "#ffffff"
    : "#000000";
}

let probeContext: CanvasRenderingContext2D | null | undefined;

/**
 * Resolve ANY CSS colour (hex, rgb(), oklch(), color(srgb …), a keyword) to
 * sRGB. The theme system writes arbitrary OKLCH at runtime, so a regex can't
 * do this; a 1x1 canvas can, because the browser converts whatever it parses.
 * Returns null on the server or when the browser can't parse the colour.
 */
export function resolveCssColor(color: string | null | undefined): Rgb | null {
  if (!color || typeof document === "undefined") return null;

  if (probeContext === undefined) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      probeContext = canvas.getContext("2d", { willReadFrequently: true });
    } catch {
      probeContext = null;
    }
  }
  const ctx = probeContext;
  if (!ctx) return null;

  // An unparseable colour leaves fillStyle unchanged, so start from a sentinel
  // that can be told apart from a real answer.
  const SENTINEL = "#010203";
  ctx.fillStyle = SENTINEL;
  const before = ctx.fillStyle;
  ctx.fillStyle = color;
  if (ctx.fillStyle === before && color.trim().toLowerCase() !== SENTINEL) return null;

  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (a === 0) return null;
  return { r, g, b };
}

/**
 * The live background colour of a card, as a CSS colour string. Reads the
 * `--card` token through a probe element, so it follows the active theme and
 * the light/dark switch.
 */
export function readCardColor(): string | null {
  if (typeof document === "undefined") return null;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1px;height:1px;pointer-events:none;background-color:var(--card)";
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color || null;
}

export interface ContrastWarning {
  /** `veryLow` is close to invisible (< 1.5:1); `low` is under 3:1. */
  level: "low" | "veryLow";
  /** The lowest ratio found. */
  ratio: number;
  /** Which colour is the problem. */
  color: "start" | "end";
}

/**
 * Whether an accent will be hard to see on the card. The title and ring are
 * large, so 3:1 is the bar (WCAG large text / non-text contrast). Returns null
 * when both colours are fine or the card colour can't be resolved.
 *
 * `cardColor` is any CSS colour string; omit it to read the live theme.
 */
export function contrastWarning(
  start: string | null | undefined,
  end: string | null | undefined,
  cardColor?: string | null,
): ContrastWarning | null {
  const card = resolveCssColor(cardColor ?? readCardColor());
  if (!card) return null;

  let worst: ContrastWarning | null = null;
  const check = (hex: string | null | undefined, which: "start" | "end") => {
    const rgb = hex ? hexToRgb(hex) : null;
    if (!rgb) return;
    const ratio = contrastRatio(rgb, card);
    if (ratio >= 3) return;
    if (!worst || ratio < worst.ratio) {
      worst = { level: ratio < 1.5 ? "veryLow" : "low", ratio, color: which };
    }
  };
  check(start, "start");
  check(end, "end");
  return worst;
}
