"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCheck, Heart, Loader2, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BURST_DOTS = 6;
const BURST_RADIUS = 15;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Like button                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export interface LikeButtonProps {
  liked: boolean;
  count: number;
  onToggle: () => void;
  disabled?: boolean;
  /** `md` on a post, `sm` on a comment. */
  size?: "md" | "sm";
  className?: string;
}

/**
 * The heart. Pops and throws a small burst of dots when it becomes liked, and
 * the count rolls up (or down). Red is the one place red is not an error: the
 * liked heart. `aria-pressed` carries the state for assistive tech; with
 * reduced motion the pop, burst and roll all collapse to a plain fade.
 */
export function LikeButton({
  liked,
  count,
  onToggle,
  disabled,
  size = "md",
  className,
}: LikeButtonProps) {
  const t = useTranslations("announcements.display");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const [burst, setBurst] = useState(0);

  const handleClick = () => {
    // The burst belongs to the tap, not to the server's answer arriving later.
    if (!liked && !reduceMotion) setBurst((n) => n + 1);
    onToggle();
  };

  const shown = count > 0 ? new Intl.NumberFormat(locale).format(count) : "";
  const roll = reduceMotion ? 0 : liked ? 8 : -8;

  return (
    <button
      type="button"
      aria-pressed={liked}
      disabled={disabled}
      onClick={handleClick}
      data-slot="like-button"
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors outline-none",
        "hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60",
        size === "md" ? "h-8" : "h-7 px-2",
        liked
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <span className="relative inline-flex">
        <motion.span
          initial={false}
          animate={liked && !reduceMotion ? { scale: [1, 1.35, 1] } : { scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="inline-flex"
        >
          <Heart
            className={cn(size === "md" ? "size-4" : "size-3.5", liked && "fill-current")}
            aria-hidden
          />
        </motion.span>

        {burst > 0 && (
          <span key={burst} aria-hidden className="pointer-events-none absolute inset-0">
            {Array.from({ length: BURST_DOTS }, (_, i) => {
              const angle = (i / BURST_DOTS) * Math.PI * 2 - Math.PI / 2;
              return (
                <motion.span
                  key={i}
                  className="absolute start-1/2 top-1/2 -ms-0.5 -mt-0.5 size-1 rounded-full bg-red-500"
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
                  animate={{
                    x: Math.cos(angle) * BURST_RADIUS,
                    y: Math.sin(angle) * BURST_RADIUS,
                    opacity: 0,
                    scale: 1,
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              );
            })}
          </span>
        )}
      </span>

      <span className="sr-only">{liked ? t("unlike") : t("like")}</span>

      <span className="relative inline-flex h-4 min-w-[1ch] items-center overflow-hidden tabular-nums">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={shown}
            initial={{ y: roll, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -roll, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {shown}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Reactions bar                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ReactionsBarProps {
  liked: boolean;
  likesCount: number;
  onToggleLike: () => void;
  likeDisabled?: boolean;

  /** `undefined` while the backend sends none (the number then simply isn't shown). */
  commentsCount?: number | null;
  /** Leave unset to hide the comment button. */
  onToggleComments?: () => void;
  commentsOpen?: boolean;

  /** `true`: "Seen". `false` with `onMarkSeen`: a "Mark as read" button. `null`/`undefined`: nothing. */
  seen?: boolean | null;
  onMarkSeen?: () => void;
  markingSeen?: boolean;

  className?: string;
}

/**
 * Like, comment and read state of one post, in one row that wraps instead of
 * overflowing on a 360px phone.
 */
export function ReactionsBar({
  liked,
  likesCount,
  onToggleLike,
  likeDisabled,
  commentsCount,
  onToggleComments,
  commentsOpen = false,
  seen,
  onMarkSeen,
  markingSeen = false,
  className,
}: ReactionsBarProps) {
  const t = useTranslations("announcements.display");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();

  const showMarkRead = seen === false && !!onMarkSeen;
  const showSeen = seen === true;

  return (
    <div
      data-slot="reactions-bar"
      className={cn("flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1", className)}
    >
      <LikeButton
        liked={liked}
        count={likesCount}
        onToggle={onToggleLike}
        disabled={likeDisabled}
      />

      {onToggleComments && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleComments}
          aria-expanded={commentsOpen}
          className={cn(
            "h-8 gap-1.5 rounded-full px-2.5 text-xs font-medium",
            commentsOpen ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <MessageCircle className="size-4" aria-hidden />
          <span>{t("comments")}</span>
          {typeof commentsCount === "number" && commentsCount > 0 && (
            <span className="tabular-nums">{new Intl.NumberFormat(locale).format(commentsCount)}</span>
          )}
        </Button>
      )}

      <div className="ms-auto flex items-center">
        <AnimatePresence mode="wait" initial={false}>
          {showMarkRead && (
            <motion.div
              key="mark"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.15 }}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={markingSeen}
                onClick={onMarkSeen}
                className="h-8 gap-1.5 text-xs"
              >
                {markingSeen ? (
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                ) : (
                  <CheckCheck className="size-3.5" aria-hidden />
                )}
                {t("markAsRead")}
              </Button>
            </motion.div>
          )}
          {showSeen && (
            <motion.span
              key="seen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.15 }}
              className="inline-flex items-center gap-1 px-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              {t("seen")}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
