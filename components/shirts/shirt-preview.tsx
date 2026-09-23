"use client";

import { useEffect, useMemo, useState } from "react";
import { Shirt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { resolveShirtAssetUrl } from "@/lib/shirts/shirt-utils";
import type {
  ShirtColor,
  ShirtLogo,
  ShirtTemplate,
} from "@/types/shirt-milestone.types";

/**
 * Fetched template markup, keyed by resolved URL. The same few templates are
 * re-rendered constantly (one per row in the history list), and a cache hit on
 * mount is what stops each of those flashing an empty box first.
 */
const SVG_CACHE = new Map<string, string>();

/** Strip width/height off the root <svg> so the CSS below governs the box. */
function normaliseSvg(markup: string): string {
  const sized = markup.replace(/<svg\b[^>]*>/i, (tag) =>
    tag.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ""),
  );
  return ensureRecolourable(sized);
}

const NON_COLOURS = new Set(["none", "transparent", "currentcolor", "inherit"]);
const SHAPE_TAG = /<(?:path|rect|circle|ellipse|polygon|polyline)\b[^>]*>/gi;
const FILL_ATTR = /\sfill\s*=\s*["']([^"']+)["']/i;
const FILL_DECL = /fill\s*:\s*([^;"'}]+)/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Artwork exported from Illustrator, Figma or a stock site never uses
 * currentColor — the body is a fixed fill like #E94720, so nothing responds to
 * the colour picker. When the template has no currentColor at all, treat its
 * dominant fill as the shirt body and swap that one colour for currentColor.
 * Collars, seams and shading use other fills and stay put.
 *
 * "Dominant" is weighted by tag length, a cheap proxy for path complexity, so
 * the big body path outweighs a scatter of small outline strokes. Templates
 * that already use currentColor are left exactly as authored.
 */
function ensureRecolourable(markup: string): string {
  if (/currentcolor/i.test(markup)) return markup;

  const weights = new Map<string, number>();
  const add = (raw: string | undefined, weight: number) => {
    const colour = raw?.trim();
    if (!colour || colour.startsWith("url(")) return;
    if (NON_COLOURS.has(colour.toLowerCase())) return;
    weights.set(colour, (weights.get(colour) ?? 0) + weight);
  };

  for (const tag of markup.match(SHAPE_TAG) ?? []) {
    const style = tag.match(/\sstyle\s*=\s*["']([^"']*)["']/i)?.[1];
    add(style?.match(FILL_DECL)?.[1] ?? tag.match(FILL_ATTR)?.[1], tag.length);
  }
  // Class-based exports (<style>.cls-1{fill:#fff}</style>) carry no fill on
  // the shapes themselves — fall back to counting the stylesheet's rules.
  if (weights.size === 0) {
    for (const block of markup.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? []) {
      for (const m of block.matchAll(/fill\s*:\s*([^;}]+)/gi)) add(m[1], 1);
    }
  }
  if (weights.size === 0) return markup;

  const body = [...weights.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const colour = escapeRegExp(body);
  return markup
    .replace(
      new RegExp(`(\\sfill\\s*=\\s*["'])\\s*${colour}\\s*(["'])`, "gi"),
      "$1currentColor$2",
    )
    .replace(new RegExp(`(fill\\s*:\\s*)${colour}(?=\\s*[;"'}])`, "gi"), "$1currentColor");
}

function parseViewBox(markup: string | null): [number, number, number, number] {
  const m = markup?.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (!m) return [0, 0, 100, 100];
  const parts = m[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length < 4 || parts.some((n) => !Number.isFinite(n))) {
    return [0, 0, 100, 100];
  }
  return [parts[0], parts[1], parts[2], parts[3]];
}

export interface ShirtPreviewProps {
  template: ShirtTemplate | null;
  color: ShirtColor | null;
  logo: ShirtLogo | null;
  className?: string;
  /** Muted shirt outline when there is no template. Default true. */
  showPlaceholder?: boolean;
}

/**
 * The live shirt preview. Entirely client-side — changing colour or logo
 * repaints instantly with no request.
 *
 * Only the shirt itself is SVG, because only its colour changes. Logos never
 * change colour, so they are stored exactly as uploaded (SVG or transparent
 * PNG) and drawn with a plain <img>; nothing ever converts between formats.
 */
export function ShirtPreview({
  template,
  color,
  logo,
  className,
  showPlaceholder = true,
}: ShirtPreviewProps) {
  const svgUrl = resolveShirtAssetUrl(template?.svg_url);
  const logoUrl = resolveShirtAssetUrl(logo?.file_url);

  const [svg, setSvg] = useState<string | null>(() =>
    svgUrl ? (SVG_CACHE.get(svgUrl) ?? null) : null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!svgUrl) {
      setSvg(null);
      setFailed(false);
      return;
    }

    const cached = SVG_CACHE.get(svgUrl);
    if (cached) {
      setSvg(cached);
      setFailed(false);
      return;
    }

    const controller = new AbortController();
    setSvg(null);
    setFailed(false);

    fetch(svgUrl, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then((text) => {
        const normalised = normaliseSvg(text);
        SVG_CACHE.set(svgUrl, normalised);
        setSvg(normalised);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFailed(true);
      });

    return () => controller.abort();
  }, [svgUrl]);

  const [minX, minY, vbW, vbH] = useMemo(() => parseViewBox(svg), [svg]);

  if (!template || failed) {
    if (!showPlaceholder) return null;
    return (
      <div
        className={cn(
          "flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground",
          className,
        )}
      >
        <Shirt className="h-10 w-10" />
        {failed && <span className="text-xs">Preview unavailable</span>}
      </div>
    );
  }

  if (!svg) {
    return <Skeleton className={cn("aspect-square w-full rounded-lg", className)} />;
  }

  const area = template.print_area;
  // Percentages of the viewBox, with the origin subtracted so a template whose
  // viewBox does not start at 0 0 still places the logo correctly.
  const logoStyle: React.CSSProperties = {
    position: "absolute",
    left: `${((area.x - minX) / vbW) * 100}%`,
    top: `${((area.y - minY) / vbH) * 100}%`,
    width: `${(area.width / vbW) * 100}%`,
    height: `${(area.height / vbH) * 100}%`,
    objectFit: "contain",
    pointerEvents: "none",
  };

  return (
    <div
      className={cn(
        "relative w-full [&>svg]:block [&>svg]:h-auto [&>svg]:w-full",
        className,
      )}
      // Every recolourable path in the artwork is fill="currentColor", so
      // setting `color` here tints the whole shirt. Collars, seams and shadows
      // carry their own fixed fills and correctly stay put.
      style={{ color: color?.hex_code ?? "var(--muted-foreground)" }}
    >
      {/* Safe to inline: templates are sanitized server-side on upload —
          scripts, event handlers, remote references and javascript: URLs are
          stripped. Inlining (rather than an <img src>) is what makes the
          currentColor recolouring above possible at all; do not "fix" this
          into an <img>. */}
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" aria-hidden="true" style={logoStyle} />
      )}
    </div>
  );
}
