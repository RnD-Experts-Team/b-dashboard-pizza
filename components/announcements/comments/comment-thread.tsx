"use client";

import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth/auth.store";
import {
  selectThread,
  useAnnouncementCommentsStore,
} from "@/lib/store/announcement-comments.store";
import { AnnouncementErrorAlert } from "../shared/announcement-error-alert";
import { CommentComposer } from "./comment-composer";
import { CommentItem } from "./comment-item";

export interface CommentThreadProps {
  announcementId: number;
  /**
   * A height cap for the LIST (a Tailwind class such as `max-h-[40dvh]`); it
   * scrolls inside while the composer stays in reach. The popup uses it.
   */
  listClassName?: string;
  /** Hide the "Comments · N" row (the post already has a Comments toggle). */
  hideHeader?: boolean;
  autoFocusComposer?: boolean;
  className?: string;
}

function CommentSkeletons() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-2.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-7/12" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The comments of one announcement, wired to `announcement-comments.store`:
 * loaded when it mounts, ten at a time (oldest first, "View more" asks for the
 * next ten), a new comment slides in, and a delete is optimistic with a
 * rollback in the store. Open it inline under a post.
 */
export function CommentThread({
  announcementId,
  listClassName,
  hideHeader = false,
  autoFocusComposer = false,
  className,
}: CommentThreadProps) {
  const t = useTranslations("announcements.comments");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();

  const thread = useAnnouncementCommentsStore(selectThread(announcementId));
  const load = useAnnouncementCommentsStore((s) => s.load);
  const loadMore = useAnnouncementCommentsStore((s) => s.loadMore);
  const remove = useAnnouncementCommentsStore((s) => s.remove);
  const toggleLike = useAnnouncementCommentsStore((s) => s.toggleLike);
  const meId = useAuthStore((s) => s.user?.id);
  const listRef = useRef<HTMLDivElement>(null);

  // After you post, the list scrolls to the end so your new comment is in view.
  // (Two frames: the comment has to be drawn before the end can be measured.)
  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const list = listRef.current;
        if (!list) return;
        list.scrollTo({ top: list.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
      }),
    );
  }, [reduceMotion]);

  // No AbortSignal on purpose: `load` skips a thread that is already loading,
  // so cancelling and re-calling (React StrictMode does exactly that in dev)
  // would leave the thread idle forever. A late answer is harmless; the store
  // keeps only the newest.
  useEffect(() => {
    void load(announcementId);
  }, [announcementId, load]);

  const { items, status, total } = thread;
  const remaining = Math.max(0, total - items.length);
  const canLoadMore = status === "success" && thread.page < thread.lastPage;
  const isMine = (userId: number | string | undefined, authorId: number | string | undefined) =>
    meId !== undefined &&
    meId !== null &&
    (String(userId) === String(meId) || String(authorId) === String(meId));

  const count = new Intl.NumberFormat(locale).format(total);

  return (
    <section
      data-slot="comment-thread"
      aria-label={t("title")}
      className={cn("flex min-w-0 flex-col gap-3", className)}
    >
      {!hideHeader && (
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <MessageCircle className="size-3.5" aria-hidden />
          {t("title")}
          {status === "success" && total > 0 && <span className="tabular-nums">· {count}</span>}
        </h3>
      )}

      <div
        ref={listRef}
        className={cn("min-h-0 overflow-y-auto overscroll-contain", listClassName)}
      >
        {(status === "idle" || status === "loading") && <CommentSkeletons />}

        {status === "error" && (
          <AnnouncementErrorAlert
            error={thread.error}
            title={t("loadError")}
            onRetry={() => void load(announcementId, { force: true })}
            compact
          />
        )}

        {status === "success" && items.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-5 text-center">
            <MessageCircle className="size-6 text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium">{t("empty")}</p>
            <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
          </div>
        )}

        {items.length > 0 && (
          <ol className="relative space-y-3 pe-1">
            <AnimatePresence initial={false} mode="popLayout">
              {items.map((comment) => (
                <motion.li
                  key={comment.id}
                  layout={reduceMotion ? false : "position"}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.15 : 0.25, ease: "easeOut" }}
                >
                  <CommentItem
                    comment={comment}
                    isMine={isMine(comment.user_id, comment.user?.id)}
                    onToggleLike={(id) => toggleLike(announcementId, id)}
                    onDelete={(id) => void remove(announcementId, id)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}

        {canLoadMore && (
          <div className="mt-2 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={thread.loadingMore}
              onClick={() => void loadMore(announcementId)}
              className="h-8 gap-1.5 text-xs text-muted-foreground"
            >
              {thread.loadingMore && (
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {t("viewMore", { count: Math.max(1, remaining) })}
            </Button>
          </div>
        )}

        {thread.loadMoreError && (
          <AnnouncementErrorAlert
            error={thread.loadMoreError}
            onRetry={() => void loadMore(announcementId)}
            compact
            className="mt-2"
          />
        )}
      </div>

      <CommentComposer
        announcementId={announcementId}
        autoFocus={autoFocusComposer}
        onPosted={scrollToEnd}
      />
    </section>
  );
}
