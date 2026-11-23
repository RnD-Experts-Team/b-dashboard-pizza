"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Accent } from "@/lib/announcements/colors";

export interface AccentFrameProps
  extends Omit<ComponentProps<"div">, "children" | "ref"> {
  /** From `accentOf(announcement)`. `none` draws the ordinary 1px border. */
  accent: Accent;
  /**
   * A rotating conic-gradient border with a soft glow. Only the popup and the
   * composer preview use it; the feed stays static. Paused while the frame is
   * off screen, and off under `prefers-reduced-motion` (see globals.css).
   */
  animated?: boolean;
  /** Radius utility shared by the ring and the content. */
  rounded?: string;
  /** Classes for the content layer (its background defaults to the card colour). */
  innerClassName?: string;
  /** Clip the content to the rounded shape (full-bleed media). Default true. */
  clip?: boolean;
  children?: ReactNode;
}

/**
 * A card border in the announcement's accent colour.
 *
 * The border is a masked `::before` ring (`mask-composite: exclude`), not a
 * `border-image` or a background trick, so it follows the corner radius and
 * works on any card colour or theme. All the CSS is in `app/globals.css`
 * (`.ann-ring`); this component only sets the `--ann-start` / `--ann-end`
 * variables and the data attributes it reads.
 */
export function AccentFrame({
  accent,
  animated = false,
  rounded = "rounded-2xl",
  innerClassName,
  clip = true,
  className,
  style,
  children,
  ...rest
}: AccentFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [offscreen, setOffscreen] = useState(false);
  const spins = animated && accent.kind !== "none";

  // An animation nobody can see should not run: pause it while off screen.
  useEffect(() => {
    if (!spins) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [spins]);

  return (
    <div
      ref={ref}
      data-slot="accent-frame"
      data-accent={accent.kind}
      data-offscreen={spins && offscreen ? "" : undefined}
      className={cn(
        "ann-ring relative isolate",
        spins && "ann-ring--animated",
        rounded,
        className,
      )}
      style={{ ...accent.cssVars, ...style }}
      {...rest}
    >
      <div
        className={cn(
          "ann-ring__inner relative bg-card",
          rounded,
          clip && "overflow-clip",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
