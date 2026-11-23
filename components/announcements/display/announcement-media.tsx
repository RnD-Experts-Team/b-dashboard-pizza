"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ImageOff, Play, RefreshCw, VideoOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDuration, safeMediaUrl } from "@/lib/announcements/media";
import type { AnnouncementMediaType } from "@/types/announcement.types";
import { MediaLightbox } from "./media-lightbox";

/**
 * Where the media is shown. It sets the height cap and the corner style:
 *  - `popup`    full width, at most 40 dvh tall
 *  - `feed`     full width (full-bleed on a post), at most half the screen (and 28 rem) tall
 *  - `comment`  as wide as the picture, at most 14 rem tall, rounded
 *  - `field`    the composer's preview, at most 16 rem tall, rounded
 */
export type AnnouncementMediaVariant = "popup" | "feed" | "comment" | "field";

const IMAGE_CAP: Record<AnnouncementMediaVariant, string> = {
  popup: "max-h-[40dvh]",
  feed: "max-h-[min(50dvh,28rem)]",
  comment: "max-h-56",
  field: "max-h-64",
};

/**
 * Pictures in these variants sit on a blurred, enlarged copy of themselves
 * instead of flat bars, so a tall or narrow picture still fills the card.
 */
const BACKDROP: Record<AnnouncementMediaVariant, boolean> = {
  popup: true,
  feed: true,
  comment: false,
  field: false,
};

const FIT_CONTENT: Record<AnnouncementMediaVariant, boolean> = {
  popup: false,
  feed: false,
  comment: true,
  field: false,
};

const ROUNDED: Record<AnnouncementMediaVariant, string> = {
  popup: "",
  feed: "",
  comment: "rounded-lg border",
  field: "rounded-lg border",
};

/** Natural sizes already seen, so a re-mounted picture reserves the right box at once. */
const naturalSize = new Map<string, { width: number; height: number }>();

export interface AnnouncementMediaProps {
  /** `media_url` (read-only, safe as a src). */
  src: string | null | undefined;
  type: AnnouncementMediaType | null | undefined;
  /** Video only; images carry no dimensions on the wire. */
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  /** Alt text for an image (the announcement title is a good one). */
  alt?: string;
  variant?: AnnouncementMediaVariant;
  /** Pause a playing video (the popup sets this while it moves to the next item). */
  paused?: boolean;
  /** Images and GIFs open a full-size viewer on click. Default true. */
  lightbox?: boolean;
  /** Seconds to wait before the fade-in (popup choreography). */
  delay?: number;
  className?: string;
}

/**
 * An announcement's image, GIF or video.
 *
 *  - Image / GIF: a reserved box with a skeleton, fade-in on load, click to
 *    enlarge, a "GIF" badge.
 *  - Video: `controls playsInline preload="metadata"`, the box taken from
 *    width/height (16:9 when missing), black-bar letterboxing.
 *  - Broken media: a tile with a retry, never a blank hole.
 *  - Always capped in height, `object-contain` on a neutral backdrop.
 */
export function AnnouncementMedia({
  src,
  type,
  width,
  height,
  durationSeconds,
  alt,
  variant = "feed",
  paused = false,
  lightbox = true,
  delay = 0,
  className,
}: AnnouncementMediaProps) {
  const safe = safeMediaUrl(src);
  const [attempt, setAttempt] = useState(0);
  if (!safe || !type) return null;

  return (
    <MediaBody
      key={`${safe}#${attempt}`}
      src={safe}
      type={type}
      width={width ?? null}
      height={height ?? null}
      durationSeconds={durationSeconds ?? null}
      alt={alt}
      variant={variant}
      paused={paused}
      lightbox={lightbox}
      delay={delay}
      className={className}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}

interface MediaBodyProps extends Required<Pick<AnnouncementMediaProps, "variant" | "paused" | "lightbox" | "delay">> {
  src: string;
  type: AnnouncementMediaType;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  alt?: string;
  className?: string;
  onRetry: () => void;
}

function MediaBody({
  src,
  type,
  width,
  height,
  durationSeconds,
  alt,
  variant,
  paused,
  lightbox,
  delay,
  className,
  onRetry,
}: MediaBodyProps) {
  const t = useTranslations("announcements.display");
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isVideo = type === "video";
  const fit = FIT_CONTENT[variant];

  // A cached image can finish loading before React attaches onLoad.
  useEffect(() => {
    const el = imageRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      naturalSize.set(src, { width: el.naturalWidth, height: el.naturalHeight });
      setStatus("ready");
    }
  }, [src]);

  // The popup moves on while a video is playing: stop it.
  useEffect(() => {
    if (paused) videoRef.current?.pause();
  }, [paused]);

  const wrapper = cn(
    "relative overflow-hidden bg-muted/50",
    fit ? "w-fit max-w-full" : "w-full",
    ROUNDED[variant],
    className,
  );

  if (status === "error") {
    const BrokenIcon = isVideo ? VideoOff : ImageOff;
    return (
      <div
        data-slot="announcement-media"
        className={cn(wrapper, "flex min-h-32 w-full flex-col items-center justify-center gap-2 p-4 text-center")}
      >
        <BrokenIcon className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-xs text-muted-foreground">{t("mediaBroken")}</p>
        <Button type="button" size="xs" variant="outline" onClick={onRetry}>
          <RefreshCw aria-hidden />
          {t("mediaRetry")}
        </Button>
      </div>
    );
  }

  /* ── Video ─────────────────────────────────────────────────────────────── */
  if (isVideo) {
    const ratio = width && height ? `${width} / ${height}` : "16 / 9";
    return (
      <div
        data-slot="announcement-media"
        data-media-type="video"
        className={cn(wrapper, "w-full bg-neutral-950", IMAGE_CAP[variant])}
        style={{ aspectRatio: ratio }}
      >
        {status === "loading" && (
          <Skeleton className="absolute inset-0 rounded-none" aria-hidden />
        )}
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          preload="metadata"
          aria-label={alt}
          className="size-full object-contain"
          onLoadedMetadata={() => setStatus("ready")}
          onError={() => setStatus("error")}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
        {status === "ready" && !playing && (
          <span className="pointer-events-none absolute start-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums backdrop-blur-sm">
            <Play className="size-3 fill-current" aria-hidden />
            {t("video")}
            {durationSeconds ? ` · ${formatDuration(durationSeconds)}` : ""}
          </span>
        )}
      </div>
    );
  }

  /* ── Image / GIF ───────────────────────────────────────────────────────── */
  const cached = naturalSize.get(src);
  const loading = status === "loading";
  // Fade in (and, with motion allowed, settle from a hair smaller) once loaded.
  const hiddenState = { opacity: 0, scale: reduceMotion ? 1 : 0.97 };
  const reserve = loading
    ? { aspectRatio: cached ? `${cached.width} / ${cached.height}` : "16 / 9" }
    : undefined;

  const image = (
    <motion.img
      ref={imageRef}
      src={src}
      alt={alt ?? t("imageAlt")}
      draggable={false}
      decoding="async"
      loading={variant === "feed" || variant === "comment" ? "lazy" : undefined}
      className={cn(
        "block object-contain",
        IMAGE_CAP[variant],
        fit ? "h-auto w-auto max-w-full" : "h-auto w-full",
      )}
      initial={hiddenState}
      animate={loading ? hiddenState : { opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0.15 : 0.35, ease: "easeOut", delay: loading ? 0 : delay }}
      onLoad={(event) => {
        const el = event.currentTarget;
        naturalSize.set(src, { width: el.naturalWidth, height: el.naturalHeight });
        setStatus("ready");
      }}
      onError={() => setStatus("error")}
    />
  );

  return (
    <div
      data-slot="announcement-media"
      data-media-type={type}
      className={cn(wrapper, loading && fit && "w-48")}
      style={reserve}
    >
      {BACKDROP[variant] && (
        // The same URL as the picture, so it comes from the cache. Decoration only.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden
          draggable={false}
          decoding="async"
          loading={variant === "feed" ? "lazy" : undefined}
          className={cn(
            "pointer-events-none absolute inset-0 size-full scale-125 object-cover blur-2xl transition-opacity duration-500 motion-reduce:transition-none",
            loading ? "opacity-0" : "opacity-50",
          )}
        />
      )}

      {loading && <Skeleton className="absolute inset-0 rounded-none" aria-hidden />}

      {lightbox ? (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label={t("viewFullSize")}
          className="relative block w-full cursor-zoom-in focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden"
        >
          {image}
        </button>
      ) : (
        image
      )}

      {type === "gif" && status === "ready" && (
        <span className="pointer-events-none absolute start-2 top-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white backdrop-blur-sm">
          {t("gif")}
        </span>
      )}

      {lightbox && (
        <MediaLightbox
          src={src}
          alt={alt ?? t("imageAlt")}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      )}
    </div>
  );
}
