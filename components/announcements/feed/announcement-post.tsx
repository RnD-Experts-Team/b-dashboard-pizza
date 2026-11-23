"use client";

import { memo, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CalendarDays, ChevronUp, Pin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { accentOf } from "@/lib/announcements/colors";
import { formatWindow } from "@/lib/announcements/status";
import { useAnnouncementCommentSummary } from "@/lib/hooks/use-announcement-comment-summary";
import { useAnnouncementStore } from "@/lib/store/announcement.store";
import type { Announcement } from "@/types/announcement.types";
import { AccentFrame } from "../display/accent-frame";
import { AccentTitle } from "../display/accent-title";
import { AnnouncementBody } from "../display/announcement-body";
import { AnnouncementMedia } from "../display/announcement-media";
import { ReactionsBar } from "../display/reactions-bar";
import { CommentPreview } from "../comments/comment-preview";
import { CommentThread } from "../comments/comment-thread";
import { RelativeTime } from "../shared/relative-time";
import { typeMetaOf } from "../shared/type-meta";

/**
 * What a post needs to draw itself. A real `Announcement` fits, and so does the
 * composer's draft (it builds one of these from the form, with no server fields).
 */
export type AnnouncementPostData = Pick<
  Announcement,
  | "id"
  | "type"
  | "title"
  | "body"
  | "is_pinned"
  | "starts_at"
  | "ends_at"
  | "media_url"
  | "media_type"
  | "media_width"
  | "media_height"
  | "media_duration_seconds"
  | "color_start"
  | "color_end"
  | "created_at"
> &
  Partial<Pick<Announcement, "likes_count" | "liked_by_me" | "seen" | "comments_count">>;

export interface AnnouncementPostProps {
  announcement: AnnouncementPostData;
  /**
   * The composer's live preview: nothing is sent to the server, like and
   * comment are switched off, and the accent ring turns (animated).
   */
  preview?: boolean;
  /** The deep-link ring: a notification brought the reader straight here. */
  highlight?: boolean;
  /** Position in the list. The first six posts fade up one after another. */
  index?: number;
  /** Adds a round up-arrow in the top corner (a read post that was opened from its compact row). */
  onCollapse?: () => void;
  className?: string;
}

/** Posts at or below this position fade up on arrival; the rest just appear. */
const STAGGER_COUNT = 6;
const STAGGER_STEP = 0.05;

/**
 * One announcement in the feed: an accent-coloured frame, the media full-bleed
 * on top, then type / pinned / time, the title, the clamped body, the visible
 * window, and the like / comment / read row. Comments open inline under the
 * post (height animated).
 */
function AnnouncementPostBase({
  announcement,
  preview = false,
  highlight = false,
  index,
  onCollapse,
  className,
}: AnnouncementPostProps) {
  const t = useTranslations("announcements");
  const tPost = useTranslations("announcements.post");
  const tWindow = useTranslations("announcements.window");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();

  const toggleLike = useAnnouncementStore((s) => s.toggleLike);
  const markSeen = useAnnouncementStore((s) => s.markSeen);
  const isMarkingSeen = useAnnouncementStore((s) => s.isMarkingSeen);

  const [commentsOpen, setCommentsOpen] = useState(false);
  // The newest comment and the count, fetched once this post is on screen.
  const summary = useAnnouncementCommentSummary(announcement.id, !preview);
  const commentsTotal = announcement.comments_count ?? summary.total;

  const accent = useMemo(
    () => accentOf({ color_start: announcement.color_start, color_end: announcement.color_end }),
    [announcement.color_start, announcement.color_end],
  );
  const meta = typeMetaOf(announcement.type);

  const windowText = formatWindow(announcement, locale, {
    noStart: tWindow("noStart"),
    noEnd: tWindow("noEnd"),
  });

  const staggered = !preview && index !== undefined && index < STAGGER_COUNT;
  const unread = !preview && announcement.seen === false;

  return (
    <motion.article
      ref={summary.ref}
      id={preview ? undefined : `announcement-${announcement.id}`}
      data-slot="announcement-post"
      data-announcement-id={preview ? undefined : announcement.id}
      aria-label={announcement.title}
      initial={staggered ? { opacity: 0, y: reduceMotion ? 0 : 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0.15 : 0.35,
        ease: "easeOut",
        delay: staggered ? (index ?? 0) * STAGGER_STEP : 0,
      }}
      className={cn("scroll-mt-24 min-w-0", className)}
    >
      <AccentFrame
        accent={accent}
        animated={preview}
        className={cn(
          "shadow-xs transition-shadow duration-500",
          highlight && "ring-2 ring-ring/70 ring-offset-2 ring-offset-background",
        )}
      >
        {onCollapse && !preview && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={tPost("collapse")}
            title={tPost("collapse")}
            className="absolute end-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-muted/90 text-foreground shadow-sm ring-1 ring-border backdrop-blur-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden motion-reduce:transition-none"
          >
            <ChevronUp className="size-4" aria-hidden />
          </button>
        )}

        {announcement.media_url && announcement.media_type && (
          <AnnouncementMedia
            src={announcement.media_url}
            type={announcement.media_type}
            width={announcement.media_width}
            height={announcement.media_height}
            durationSeconds={announcement.media_duration_seconds}
            alt={announcement.title}
            variant="feed"
          />
        )}

        <div className="min-w-0 space-y-3 p-4 sm:p-5">
          {(announcement.is_pinned || unread) && (
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {announcement.is_pinned && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <Pin className="size-3" aria-hidden />
                  {tPost("pinned")}
                </span>
              )}

              {unread && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  <span className="size-1.5 rounded-full bg-blue-500" aria-hidden />
                  {tPost("unread")}
                </span>
              )}
            </div>
          )}

          {/* The title and "General - 4 days ago" share one row. */}
          <div
            className={cn(
              "flex min-w-0 items-start justify-between gap-3",
              onCollapse && !preview && !announcement.media_url && "pe-8",
            )}
          >
            <AccentTitle accent={accent} as="h2" className="min-w-0 text-lg sm:text-xl">
              {announcement.title}
            </AccentTitle>

            <span className="mt-1 flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-foreground/70 sm:mt-1.5">
              {meta.type === "urgent" && <AlertTriangle className="size-3.5" aria-hidden />}
              <span>{t(meta.labelKey)}</span>
              <span aria-hidden>-</span>
              <RelativeTime value={announcement.created_at} />
            </span>
          </div>

          <AnnouncementBody html={announcement.body} maxLines={6} />

          <p className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="mt-px size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
              <span className="sr-only">{tPost("window")}: </span>
              {windowText}
            </span>
          </p>
        </div>

        {/* In the preview nothing can be pressed: it only shows how the row looks. */}
        <div className="border-t px-2 py-1.5 sm:px-3" inert={preview || undefined}>
          <ReactionsBar
            liked={announcement.liked_by_me ?? false}
            likesCount={announcement.likes_count ?? 0}
            onToggleLike={() => toggleLike(announcement.id)}
            likeDisabled={preview}
            commentsCount={commentsTotal ?? undefined}
            onToggleComments={() => setCommentsOpen((open) => !open)}
            commentsOpen={commentsOpen && !preview}
            seen={preview ? undefined : announcement.seen}
            onMarkSeen={() => void markSeen([announcement.id])}
            markingSeen={isMarkingSeen}
          />
        </div>

        {!preview && !commentsOpen && summary.latest && (
          <CommentPreview
            comment={summary.latest}
            total={commentsTotal ?? null}
            onOpen={() => setCommentsOpen(true)}
          />
        )}

        <AnimatePresence initial={false}>
          {commentsOpen && !preview && (
            <motion.div
              key="thread"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.25, ease: "easeInOut" }}
              className="overflow-hidden border-t"
            >
              <div className="p-4 sm:p-5">
                <CommentThread
                  announcementId={announcement.id}
                  hideHeader
                  listClassName="h-[min(20rem,50dvh)]"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AccentFrame>
    </motion.article>
  );
}

export const AnnouncementPost = memo(AnnouncementPostBase);
