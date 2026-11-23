"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Check, Loader2, Pin, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { accentOf } from "@/lib/announcements/colors";
import { formatWindow } from "@/lib/announcements/status";
import { useAnnouncementStore } from "@/lib/store/announcement.store";
import type { Announcement } from "@/types/announcement.types";
import { AccentFrame } from "../display/accent-frame";
import { AccentTitle } from "../display/accent-title";
import { AnnouncementBody } from "../display/announcement-body";
import { AnnouncementMedia } from "../display/announcement-media";
import { ReactionsBar } from "../display/reactions-bar";
import { CommentThread } from "../comments/comment-thread";
import { typeMetaOf } from "../shared/type-meta";

/**
 * The announcement popup.
 *
 *  - `mode="queue"` (the default): the forced on-load popup. It shows every
 *    unseen announcement one after another (oldest first) with a "1 / 3"
 *    counter and dots. It cannot be dismissed: Esc and clicks outside are
 *    blocked, and "Got it" is the only way on. "Got it" marks the item seen
 *    and slides to the next; on the last one the popup closes.
 *  - `mode="preview"`: the same card for the admin's Preview action. One
 *    announcement, dismissible, nothing is marked seen, like and comment are off.
 *
 * Layout: the card is a flex column capped at `100dvh - 2rem`. The header and
 * footer never shrink; only the middle (media, title, text, comments) scrolls,
 * so "Got it" is always reachable on a short phone.
 *
 * Entrance choreography (reduced motion: plain fades): a blank card with faint
 * shimmer lines and the ring already turning, then (from 250 ms) the type pill
 * drops in, the title de-blurs and shines once, the media fades in when loaded,
 * the text blocks rise 40 ms apart, and the footer comes last. Moving on to the
 * next item is a short slide.
 *
 * This file is loaded with `next/dynamic` (see `announcement-onload-popup.tsx`),
 * and so is the preview, so it must not import the `kit.ts` barrel (that pulls
 * in the editor).
 */

export interface AnnouncementPopupCardProps {
  mode?: "queue" | "preview";
  /** preview mode: what to show. */
  announcement?: Announcement | null;
  /** preview mode: whether the dialog is open. */
  open?: boolean;
  /** preview mode: called when it is dismissed. */
  onOpenChange?: (open: boolean) => void;
}

/** Past this many items the dots are left out; the counter still tells the position. */
const MAX_DOTS = 7;

const nf = (locale: string, n: number) => new Intl.NumberFormat(locale).format(n);

function readIsRtl(): boolean {
  return typeof document !== "undefined" && document.documentElement.dir === "rtl";
}

/** A playing video must stop when the card moves on (it would keep sounding for the exit animation). */
function pauseVideos(root: HTMLElement | null) {
  root?.querySelectorAll("video").forEach((video) => video.pause());
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Entry point                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export function AnnouncementPopupCard(props: AnnouncementPopupCardProps) {
  if (props.mode === "preview") {
    return (
      <PreviewPopup
        announcement={props.announcement ?? null}
        open={props.open ?? false}
        onOpenChange={props.onOpenChange}
      />
    );
  }
  return <QueuePopup />;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The dialog shell                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function PopupShell({
  open,
  onOpenChange,
  forced,
  title,
  description,
  contentRef,
  children,
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Cannot be dismissed. */
  forced: boolean;
  title: string;
  description: string;
  contentRef: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const block = forced ? (event: Event) => event.preventDefault() : undefined;

  return (
    <Dialog open={open} onOpenChange={forced ? undefined : onOpenChange}>
      <DialogContent
        ref={contentRef}
        showCloseButton={false}
        onInteractOutside={block}
        onPointerDownOutside={block}
        onEscapeKeyDown={block}
        // Focus the dialog itself, not a button: someone typing when it appears
        // must not dismiss it with a stray Enter.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus({ preventScroll: true });
        }}
        className="w-[min(36rem,calc(100vw-1.5rem))] max-w-none gap-0 rounded-2xl border-0 bg-transparent p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Queue mode                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function QueuePopup() {
  const t = useTranslations("announcements.popup");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();

  const queue = useAnnouncementStore((s) => s.unseen.queue);
  const acknowledgeCurrent = useAnnouncementStore((s) => s.acknowledgeCurrent);

  const current = queue[0];

  // After the last "Got it" the queue is empty but the card is still fading
  // out: keep drawing the last item until it is gone.
  const [held, setHeld] = useState<Announcement | null>(null);
  if (current && current !== held) setHeld(current);
  const item = current ?? held;

  // How many were acknowledged in this session, for "2 / 3".
  const [done, setDone] = useState(0);
  const total = done + queue.length;
  const position = Math.min(done + 1, Math.max(total, 1));

  // The item whose "Got it" was pressed: disables the button until the next one shows.
  const [leavingId, setLeavingId] = useState<number | null>(null);
  const leaving = item !== null && leavingId === item.id;

  const contentRef = useRef<HTMLDivElement>(null);
  const [rtl] = useState(readIsRtl);

  const handleGotIt = () => {
    if (!current || leavingId === current.id) return;
    pauseVideos(contentRef.current);
    setLeavingId(current.id);
    setDone((n) => n + 1);
    // Advances at once; a failed mark-seen is reported (quietly) by the store.
    void acknowledgeCurrent();
  };

  const slide = reduceMotion ? 0 : rtl ? -28 : 28;

  return (
    <PopupShell
      open={queue.length > 0}
      forced
      title={item?.title ?? ""}
      description={t("description")}
      contentRef={contentRef}
    >
      {/* Read out when the item changes; the visible counter is aria-hidden. */}
      <span className="sr-only" role="status" aria-live="polite">
        {t("position", { current: nf(locale, position), total: nf(locale, total) })}
      </span>

      <AnimatePresence mode="wait" initial={false}>
        {item && (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: slide }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -slide }}
            transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: "easeOut" }}
          >
            <PopupFrame
              item={item}
              preview={false}
              intro={done === 0}
              position={position}
              total={total}
              leaving={leaving}
              onGotIt={handleGotIt}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </PopupShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Preview mode                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

function PreviewPopup({
  announcement,
  open,
  onOpenChange,
}: {
  announcement: Announcement | null;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("announcements.popup");
  const contentRef = useRef<HTMLDivElement>(null);

  // Keep the last announcement drawn while the dialog fades out.
  const [held, setHeld] = useState<Announcement | null>(null);
  if (announcement && announcement !== held) setHeld(announcement);
  const item = announcement ?? held;

  return (
    <PopupShell
      open={open && item !== null}
      onOpenChange={onOpenChange}
      forced={false}
      title={item?.title ?? ""}
      description={t("previewDescription")}
      contentRef={contentRef}
    >
      {item && (
        <PopupFrame
          item={item}
          preview
          intro
          position={1}
          total={1}
          leaving={false}
          onGotIt={() => onOpenChange?.(false)}
        />
      )}
    </PopupShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The card                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

interface PopupFrameProps {
  item: Announcement;
  preview: boolean;
  /** The first card of the session gets the whole entrance; later ones a short one. */
  intro: boolean;
  position: number;
  total: number;
  leaving: boolean;
  onGotIt: () => void;
}

function PopupFrame({
  item,
  preview,
  intro,
  position,
  total,
  leaving,
  onGotIt,
}: PopupFrameProps) {
  const t = useTranslations("announcements");
  const tPopup = useTranslations("announcements.popup");
  const tPost = useTranslations("announcements.post");
  const tWindow = useTranslations("announcements.window");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();

  const toggleLike = useAnnouncementStore((s) => s.toggleLike);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const accent = useMemo(
    () => accentOf({ color_start: item.color_start, color_end: item.color_end }),
    [item.color_start, item.color_end],
  );
  const meta = typeMetaOf(item.type);

  const windowText = formatWindow(item, locale, {
    noStart: tWindow("noStart"),
    noEnd: tWindow("noEnd"),
  });

  // When things start: after the blank, shimmering card on the first showing.
  const base = intro && !reduceMotion ? 0.25 : 0.05;
  const showDots = total > 1 && total <= MAX_DOTS;

  return (
    <AccentFrame
      accent={accent}
      animated
      rounded="rounded-2xl"
      innerClassName="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col"
    >
      {/* Header: type, pinned, and where we are in the queue */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-4 pb-2 sm:px-5">
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: base }}
          className="text-xs font-medium text-muted-foreground"
        >
          {t(meta.labelKey)}
        </motion.span>

        {item.is_pinned && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Pin className="size-3" aria-hidden />
            {tPost("pinned")}
          </span>
        )}

        <div className="ms-auto flex items-center gap-2">
          {preview ? (
            <>
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {tPopup("previewBadge")}
              </span>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="-me-1.5 size-7 text-muted-foreground"
                >
                  <X aria-hidden />
                  <span className="sr-only">{tPopup("close")}</span>
                </Button>
              </DialogClose>
            </>
          ) : (
            total > 1 && (
              <div className="flex items-center gap-2" aria-hidden>
                {showDots && (
                  <span className="flex items-center gap-1">
                    {Array.from({ length: total }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none",
                          i + 1 === position
                            ? "w-4 bg-foreground/70"
                            : "w-1.5 bg-muted-foreground/30",
                        )}
                      />
                    ))}
                  </span>
                )}
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {nf(locale, position)} / {nf(locale, total)}
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* The only part that scrolls */}
      <div
        data-slot="popup-scroll"
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {item.media_url && item.media_type && (
          <AnnouncementMedia
            src={item.media_url}
            type={item.media_type}
            width={item.media_width}
            height={item.media_height}
            durationSeconds={item.media_duration_seconds}
            alt={item.title}
            variant="popup"
            delay={base + 0.1}
          />
        )}

        <div className="relative min-w-0 space-y-3 px-4 py-4 sm:px-5">
          {intro && !reduceMotion && <ShimmerLines />}

          {/* The dialog's own (sr-only) title carries the name; this one is for the eyes. */}
          <div aria-hidden>
            <AccentTitle
              accent={accent}
              as="p"
              animateIn
              shine
              delay={base + 0.05}
              className="text-xl sm:text-2xl"
            >
              {item.title}
            </AccentTitle>
          </div>

          <div
            className="ann-stagger"
            style={{ "--ann-stagger-base": `${base + 0.15}s` } as CSSProperties}
          >
            <AnnouncementBody html={item.body} maxLines={null} size="md" />
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: base + 0.3 }}
            className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground"
          >
            <CalendarDays className="mt-px size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
              <span className="sr-only">{tPost("window")}: </span>
              {windowText}
            </span>
          </motion.p>

          <AnimatePresence initial={false}>
            {commentsOpen && !preview && (
              <motion.div
                ref={threadRef}
                key="thread"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.25, ease: "easeInOut" }}
                onAnimationComplete={(definition) => {
                  // Bring the thread (and its box) into view once it has OPENED
                  // (the same callback also fires when it has closed).
                  if ((definition as { opacity?: number }).opacity !== 1) return;
                  threadRef.current?.scrollIntoView({
                    block: "nearest",
                    behavior: reduceMotion ? "auto" : "smooth",
                  });
                }}
                className="overflow-hidden border-t"
              >
                <div className="pt-3">
                  <CommentThread
                    announcementId={item.id}
                    hideHeader
                    listClassName="h-[min(18rem,40dvh)]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer: like / comments, and the one way forward */}
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: base + 0.35 }}
        className="shrink-0 border-t bg-card"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2.5 sm:px-4">
          <div className="min-w-0 flex-1" inert={preview || undefined}>
            <ReactionsBar
              liked={item.liked_by_me ?? false}
              likesCount={item.likes_count ?? 0}
              onToggleLike={() => toggleLike(item.id)}
              likeDisabled={preview}
              commentsCount={item.comments_count}
              onToggleComments={() => setCommentsOpen((open) => !open)}
              commentsOpen={commentsOpen && !preview}
            />
          </div>

          {preview ? (
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                {tPopup("close")}
              </Button>
            </DialogClose>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={leaving}
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.currentTarget.blur();
                onGotIt();
              }}
              className="shrink-0 gap-1.5"
            >
              {leaving ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <Check aria-hidden />
              )}
              {tPopup("gotIt")}
            </Button>
          )}
        </div>
      </motion.div>
    </AccentFrame>
  );
}

/** The faint placeholder lines the blank card shows while the content is still arriving. */
function ShimmerLines() {
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="pointer-events-none absolute inset-x-4 top-4 z-10 space-y-3 sm:inset-x-5"
    >
      <div className="h-6 w-2/3 animate-pulse rounded bg-muted/70" />
      <div className="space-y-2">
        <div className="h-3.5 w-full animate-pulse rounded bg-muted/60" />
        <div className="h-3.5 w-11/12 animate-pulse rounded bg-muted/60" />
        <div className="h-3.5 w-7/12 animate-pulse rounded bg-muted/60" />
      </div>
    </motion.div>
  );
}
