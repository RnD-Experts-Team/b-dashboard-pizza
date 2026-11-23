"use client";

import { type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Accent } from "@/lib/announcements/colors";

export interface AccentTitleProps {
  children: ReactNode;
  accent: Accent;
  /** Heading level (visual size comes from `className`). Default h2. */
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  /**
   * The popup's entrance: the title de-blurs (blur 6 → 0, y 8 → 0) after
   * `delay` seconds. Reduced motion gets a plain fade. Wraps the heading in a
   * block element, so leave it off for an inline (`as="span"`) title.
   */
  animateIn?: boolean;
  delay?: number;
  /** One light sweep across the text, once, after `delay` + 0.35 s. */
  shine?: boolean;
  className?: string;
  id?: string;
}

/**
 * Emoji, one match per emoji (flags, keycaps, skin tones and ZWJ sequences stay
 * whole). Used to take emoji out of the gradient text clip.
 */
const EMOJI_RE =
  /(\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}]|\u200D\p{Extended_Pictographic})*|[\u{1F1E6}-\u{1F1FF}]{2}|[#*0-9]\uFE0F?\u20E3)/u;

/**
 * Inline on purpose: it has to beat the gradient rules however the CSS build
 * orders them. `inline-block` makes the emoji its own paint box, which the
 * parent's `background-clip: text` does not reach into.
 */
const EMOJI_STYLE: CSSProperties = {
  display: "inline-block",
  WebkitTextFillColor: "initial",
  color: "var(--foreground)",
};

/**
 * Gradient text is painted with `background-clip: text`, which turns every glyph
 * into a mask, so an emoji comes out as a solid blob of gradient (a purple
 * circle). Wrapping each emoji in `.ann-emoji` gives it back its own colours.
 */
function withEmoji(children: ReactNode): ReactNode {
  if (typeof children !== "string") return children;
  return children.split(EMOJI_RE).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="ann-emoji" style={EMOJI_STYLE}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * The title of an announcement in its accent colour.
 *
 * Gradient text (`.ann-title-gradient`) mixes each accent colour with the
 * foreground colour, so a pale accent on a light card (or a dark one on a dark
 * card) still reads. With no accent it is an ordinary heading. Long titles wrap
 * and break anywhere rather than overflow.
 */
export function AccentTitle({
  children,
  accent,
  as: Tag = "h2",
  animateIn = false,
  delay = 0,
  shine = false,
  className,
  id,
}: AccentTitleProps) {
  const reduceMotion = useReducedMotion();

  const style: CSSProperties = {
    ...accent.cssVars,
    ...(shine ? ({ "--ann-shine-delay": `${delay + 0.35}s` } as CSSProperties) : null),
  };

  const heading = (
    <Tag
      id={id}
      data-slot="accent-title"
      className={cn(
        "font-heading text-lg leading-snug font-semibold tracking-tight break-words [overflow-wrap:anywhere]",
        accent.kind !== "none" && "ann-title-gradient",
        accent.kind !== "none" && shine && "ann-title-shine",
        className,
      )}
      style={style}
    >
      {accent.kind !== "none" ? withEmoji(children) : children}
    </Tag>
  );

  if (!animateIn) return heading;

  return (
    <motion.div
      className="min-w-0"
      initial={
        reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(6px)" }
      }
      animate={
        reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }
      }
      transition={{ duration: reduceMotion ? 0.2 : 0.45, ease: "easeOut", delay }}
    >
      {heading}
    </motion.div>
  );
}
