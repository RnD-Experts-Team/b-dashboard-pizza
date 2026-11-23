"use client";

import { memo, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ChevronDown, Heart, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { accentOf } from "@/lib/announcements/colors";
import { safeMediaUrl } from "@/lib/announcements/media";
import { htmlToText } from "@/lib/announcements/text";
import { AccentFrame } from "../display/accent-frame";
import { AccentTitle } from "../display/accent-title";
import { RelativeTime } from "../shared/relative-time";
import { typeMetaOf } from "../shared/type-meta";
import type { AnnouncementPostData } from "./announcement-post";

export interface AnnouncementPostCompactProps {
  announcement: AnnouncementPostData;
  /** Position in the list (the first posts fade up one after another). */
  index?: number;
  /** Open the full post. */
  onExpand: () => void;
  className?: string;
}

const STAGGER_COUNT = 6;
const STAGGER_STEP = 0.05;

/** A small picture of what the post carries; nothing when it carries nothing. */
function Thumb({ post }: { post: AnnouncementPostData }) {
  const [failed, setFailed] = useState(false);
  const src = safeMediaUrl(post.media_url);
  if (!src || !post.media_type) return null;

  if (post.media_type === "video") {
    return (
      <span
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
      >
        <Play className="size-4 fill-current" />
      </span>
    );
  }
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className="size-12 shrink-0 rounded-md bg-muted object-cover"
    />
  );
}

/**
 * A post that was already read when the feed loaded, drawn as one row: a
 * thumbnail, the title, "General - 4 days ago", one line of the text and the
 * like count. Pressing it opens the full post. Keeps the accent colour frame so
 * the post is still recognisable.
 */
function AnnouncementPostCompactBase({
  announcement,
  index,
  onExpand,
  className,
}: AnnouncementPostCompactProps) {
  const t = useTranslations("announcements");
  const tPost = useTranslations("announcements.post");
  const reduceMotion = useReducedMotion();

  const accent = useMemo(
    () => accentOf({ color_start: announcement.color_start, color_end: announcement.color_end }),
    [announcement.color_start, announcement.color_end],
  );
  const meta = typeMetaOf(announcement.type);
  const excerpt = useMemo(() => htmlToText(announcement.body), [announcement.body]);
  const likes = announcement.likes_count ?? 0;

  const staggered = index !== undefined && index < STAGGER_COUNT;

  return (
    <motion.article
      id={`announcement-${announcement.id}`}
      data-slot="announcement-post"
      data-compact="true"
      data-announcement-id={announcement.id}
      initial={staggered ? { opacity: 0, y: reduceMotion ? 0 : 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0.15 : 0.3,
        ease: "easeOut",
        delay: staggered ? (index ?? 0) * STAGGER_STEP : 0,
      }}
      className={cn("scroll-mt-24 min-w-0", className)}
    >
      <AccentFrame accent={accent} rounded="rounded-xl" className="shadow-xs">
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={false}
          aria-label={tPost("expand", { title: announcement.title })}
          className="flex w-full min-w-0 items-center gap-3 p-3 text-start transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-hidden motion-reduce:transition-none"
        >
          <Thumb post={announcement} />

          <span className="min-w-0 flex-1">
            <AccentTitle
              accent={accent}
              as="span"
              className="block min-w-0 truncate text-sm sm:text-base"
            >
              {announcement.title}
            </AccentTitle>
            {excerpt && (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{excerpt}</span>
            )}
          </span>

          {/* Type and time, the likes and the arrow: one group, all centred on the row. */}
          <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 whitespace-nowrap text-foreground/70">
              {meta.type === "urgent" && <AlertTriangle className="size-3.5" aria-hidden />}
              <span className="hidden sm:inline">{t(meta.labelKey)}</span>
              <span aria-hidden className="hidden sm:inline">
                -
              </span>
              <RelativeTime value={announcement.created_at} />
            </span>
            {likes > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Heart className="size-3.5" aria-hidden />
                {likes}
              </span>
            )}
            <ChevronDown className="size-4" aria-hidden />
          </span>
        </button>
      </AccentFrame>
    </motion.article>
  );
}

export const AnnouncementPostCompact = memo(AnnouncementPostCompactBase);
