"use client";

import { useCallback, useEffect, useRef } from "react";
import type { AnnouncementComment } from "@/types/announcement.types";
import { useAnnouncementCommentsStore } from "@/lib/store/announcement-comments.store";
import { useCommentPreviewsStore } from "@/lib/store/announcement-comment-previews.store";

export interface CommentSummary {
  /** Attach to the post's element: the preview is only fetched once it is on screen. */
  ref: (element: Element | null) => void;
  /** How many comments, when known. */
  total: number | null;
  /** The newest comment, when known. */
  latest: AnnouncementComment | null;
}

/**
 * How many comments a post has and the newest one, without opening its thread.
 *
 * Once the thread has been opened and fully loaded, its own data wins (so a
 * comment you just posted shows up at once); until then it comes from the
 * preview store. `enabled` is false for a compact row, the composer's preview
 * and anything else that should not cost a request.
 */
export function useAnnouncementCommentSummary(
  announcementId: number,
  enabled: boolean,
): CommentSummary {
  const ensure = useCommentPreviewsStore((s) => s.ensure);
  const preview = useCommentPreviewsStore((s) => s.previews[announcementId]);
  const thread = useAnnouncementCommentsStore((s) => s.threads[announcementId]);

  const observer = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (element: Element | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!element || !enabled) return;

      if (typeof IntersectionObserver === "undefined") {
        ensure(announcementId);
        return;
      }
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            ensure(announcementId);
            observer.current?.disconnect();
          }
        },
        { rootMargin: "200px 0px" },
      );
      observer.current.observe(element);
    },
    [announcementId, enabled, ensure],
  );

  useEffect(() => () => observer.current?.disconnect(), []);

  const threadLoaded = thread?.status === "success";
  const threadComplete = threadLoaded && thread.page >= thread.lastPage;

  const total = threadLoaded ? thread.total : preview?.status === "ready" ? preview.total : null;
  const latest = threadComplete
    ? (thread.items[thread.items.length - 1] ?? null)
    : preview?.status === "ready"
      ? preview.latest
      : null;

  return { ref, total, latest };
}
