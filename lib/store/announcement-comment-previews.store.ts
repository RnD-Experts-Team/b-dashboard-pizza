import { create } from "zustand";
import type { AnnouncementComment } from "@/types/announcement.types";
import { announcementCommentsService } from "@/lib/api/services/announcement-comments.service";

/**
 * The newest comment of each announcement and how many there are, for the
 * one-line preview under a post, without opening the thread.
 *
 * The backend sends neither a comment count nor the latest comment with an
 * announcement, so a preview costs requests: ONE (`per_page=1`, which also tells
 * us the total) when there are 0 or 1 comments, TWO when there are more (the
 * second asks for the last page of size 1). To keep that cheap:
 *
 *  - the feed only asks for a post that is open and scrolled into view;
 *  - at most `CONCURRENCY` previews load at a time, the rest wait their turn;
 *  - a post is asked for once (a failure is quiet and may be retried once the
 *    post comes into view again).
 *
 * If the backend ever adds `comments_count` / `latest_comment` to the
 * announcement payload, this store goes away.
 */

export interface CommentPreview {
  status: "loading" | "ready" | "error";
  total: number;
  latest: AnnouncementComment | null;
}

interface PreviewsState {
  previews: Record<number, CommentPreview>;
}

interface PreviewsActions {
  /** Load the preview of this announcement, unless it is loaded or loading. */
  ensure: (announcementId: number) => void;
}

const CONCURRENCY = 2;
const queue: number[] = [];
let active = 0;

export const useCommentPreviewsStore = create<PreviewsState & PreviewsActions>()((set, get) => {
  async function fetchPreview(id: number): Promise<CommentPreview> {
    const first = await announcementCommentsService.list(id, { page: 1, perPage: 1 });
    let latest = first.items[0] ?? null;
    const total = Math.max(first.total, first.items.length);
    if (total > 1) {
      const last = await announcementCommentsService.list(id, { page: total, perPage: 1 });
      latest = last.items[0] ?? latest;
    }
    return { status: "ready", total, latest };
  }

  function pump() {
    while (active < CONCURRENCY && queue.length > 0) {
      const id = queue.shift()!;
      active += 1;
      fetchPreview(id)
        .then((preview) => set((s) => ({ previews: { ...s.previews, [id]: preview } })))
        .catch(() =>
          set((s) => ({
            previews: { ...s.previews, [id]: { status: "error", total: 0, latest: null } },
          })),
        )
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  }

  return {
    previews: {},
    ensure: (announcementId) => {
      const current = get().previews[announcementId];
      if (current && current.status !== "error") return;
      set((s) => ({
        previews: {
          ...s.previews,
          [announcementId]: { status: "loading", total: current?.total ?? 0, latest: null },
        },
      }));
      queue.push(announcementId);
      pump();
    },
  };
});
