"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { renderAnnouncementHtml } from "@/lib/announcements/sanitize";

export interface AnnouncementBodyProps {
  /** The raw HTML body. It is always sanitized here; never render it yourself. */
  html: string | null | undefined;
  /**
   * Lines shown before "Read more". `null` never clamps (the popup, which
   * scrolls instead). Default 6. "Read more" only appears when the text really
   * is longer than that.
   */
  maxLines?: number | null;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  size?: "sm" | "md";
  className?: string;
}

interface Metrics {
  /** Natural height of the whole body, px. */
  content: number;
  /** One line, px. */
  line: number;
}

/**
 * An announcement body: sanitized + linkified HTML, optionally clamped.
 *
 * The clamp is a measured max-height (a ResizeObserver reads the real height),
 * not `line-clamp`, which counts lines unreliably across paragraphs, lists and
 * headings. Text that fits is never clamped, and a body only one line over the
 * limit is shown whole rather than hidden behind a button.
 */
export function AnnouncementBody({
  html,
  maxLines = 6,
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
  size = "sm",
  className,
}: AnnouncementBodyProps) {
  const t = useTranslations("announcements.display");
  const reduceMotion = useReducedMotion();
  const regionId = useId();
  const innerRef = useRef<HTMLDivElement>(null);

  const safeHtml = useMemo(() => renderAnnouncementHtml(html), [html]);
  // The SAME object between renders: React sets innerHTML again whenever this prop
  // is a new object, even with identical text, which rebuilt the body on every
  // like (replaying the popup's rise-in animation and dropping any text selection).
  const innerHtml = useMemo(() => ({ __html: safeHtml }), [safeHtml]);

  const [expandedState, setExpandedState] = useState(defaultExpanded);
  const expanded = expandedProp ?? expandedState;
  const setExpanded = (next: boolean) => {
    if (expandedProp === undefined) setExpandedState(next);
    onExpandedChange?.(next);
  };

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [settled, setSettled] = useState(false);

  // Measure before paint, then keep measuring (fonts load, the card resizes).
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || maxLines === null) return;

    const measure = () => {
      const style = getComputedStyle(el);
      const parsed = parseFloat(style.lineHeight);
      const line = Number.isFinite(parsed) ? parsed : (parseFloat(style.fontSize) || 14) * 1.6;
      const content = el.offsetHeight;
      setMetrics((prev) =>
        prev && prev.content === content && prev.line === line ? prev : { content, line },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [safeHtml, maxLines, size]);

  // The first measurement must not animate (it would look like the text shrinking).
  useEffect(() => {
    if (!metrics) return;
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, [metrics]);

  if (!safeHtml) return null;

  const collapsedHeight = metrics && maxLines !== null ? maxLines * metrics.line : null;
  const overflowing =
    metrics !== null && collapsedHeight !== null && metrics.content > collapsedHeight + metrics.line;
  const clamped = overflowing && !expanded;

  const targetHeight: number | "auto" =
    metrics === null || collapsedHeight === null || !overflowing
      ? "auto"
      : expanded
        ? metrics.content
        : collapsedHeight;

  return (
    <div data-slot="announcement-body" className={cn("min-w-0", className)}>
      <motion.div
        id={regionId}
        initial={false}
        animate={{ height: targetHeight }}
        transition={{ duration: settled && !reduceMotion ? 0.25 : 0, ease: "easeInOut" }}
        className={cn(
          // A little side room so a focused link's outline is not clipped.
          "-mx-1 overflow-hidden px-1",
          clamped &&
            "[mask-image:linear-gradient(to_bottom,black_calc(100%_-_2.5em),transparent)]",
        )}
      >
        <div
          ref={innerRef}
          className={cn(
            "announcement-body break-words [overflow-wrap:anywhere]",
            size === "md" ? "text-base leading-relaxed" : "text-sm leading-relaxed",
          )}
          // Sanitized by renderAnnouncementHtml (DOMPurify allowlist, safe links).
          dangerouslySetInnerHTML={innerHtml}
        />
      </motion.div>

      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={regionId}
          className="mt-1 inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden"
        >
          {expanded ? t("readLess") : t("readMore")}
          <ChevronDown
            className={cn(
              "size-3.5 transition-[rotate] duration-200 motion-reduce:transition-none",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      )}
    </div>
  );
}
