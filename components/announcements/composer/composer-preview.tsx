"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { hexToRgb } from "@/lib/announcements/colors";
import { AnnouncementPost, type AnnouncementPostData } from "../feed/announcement-post";

export interface ComposerPreviewProps {
  /** The form as a post. `null` while an announcement is still loading (edit mode). */
  draft: AnnouncementPostData | null;
}

const TWEEN_MS = 350;

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const part = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/**
 * A colour that eases from what it showed to the new target (350 ms) instead of
 * jumping, so picking a swatch or dragging the colour input glides through the
 * ring and the title. Going to or from "no colour", or with reduced motion, it
 * just changes.
 */
function useTweenedHex(target: string | null, reduceMotion: boolean): string | null {
  const [shown, setShown] = useState<string | null>(target);
  const shownRef = useRef<string | null>(target);

  useEffect(() => {
    const from = shownRef.current ? hexToRgb(shownRef.current) : null;
    const to = target ? hexToRgb(target) : null;
    if (reduceMotion || !from || !to) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    if (shownRef.current === target) return;

    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / TWEEN_MS);
      const eased = 1 - (1 - progress) ** 3;
      const value = toHex({
        r: from.r + (to.r - from.r) * eased,
        g: from.g + (to.g - from.g) * eased,
        b: from.b + (to.b - from.b) * eased,
      });
      shownRef.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduceMotion]);

  // A change that cannot glide (to or from no colour, reduced motion) shows at
  // once, without waiting for the effect above.
  const gliding = !reduceMotion && !!shown && !!target && !!hexToRgb(shown) && !!hexToRgb(target);
  return gliding ? shown : target;
}

/**
 * The live preview: the real feed post in its preview mode (nothing is sent,
 * like and comment are off, the accent ring turns). It re-renders with every
 * keystroke, and a colour change glides.
 */
export function ComposerPreview({ draft }: ComposerPreviewProps) {
  const t = useTranslations("announcements.composer");
  const reduceMotion = useReducedMotion() ?? false;

  const start = useTweenedHex(draft?.color_start ?? null, reduceMotion);
  const end = useTweenedHex(draft?.color_end ?? null, reduceMotion);

  const shown = useMemo(
    () => (draft ? { ...draft, color_start: start, color_end: end } : null),
    [draft, start, end],
  );

  return (
    <div data-slot="composer-preview" className="space-y-3">
      <div className="space-y-0.5">
        <h3 className="font-heading text-sm font-semibold">{t("previewTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("previewHint")}</p>
      </div>

      {shown ? (
        <AnnouncementPost announcement={shown} preview />
      ) : (
        <div aria-hidden className="space-y-3 rounded-2xl border bg-card p-5">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-9/12" />
        </div>
      )}
    </div>
  );
}
