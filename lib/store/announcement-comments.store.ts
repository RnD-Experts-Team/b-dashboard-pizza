import { create } from "zustand";
import axios from "axios";
import { toast } from "sonner";
import type {
  AnnouncementComment,
  CreateCommentPayload,
  LikeResult,
} from "@/types/announcement.types";
import { announcementCommentsService } from "@/lib/api/services/announcement-comments.service";
import {
  parseAnnouncementError,
  type AnnouncementError,
} from "@/lib/announcements/errors";
import {
  useAnnouncementStore,
  type LoadStatus,
  type StoreResult,
} from "./announcement.store";

/**
 * Comment threads, keyed by announcement id. Each thread is loaded on demand
 * (when a post's comments are opened), oldest first, a page at a time.
 *
 *  - `load` / `loadMore`  page 1, then the next pages appended
 *  - `post`               appends the new comment, total + 1
 *  - `remove`             optimistic, put back (in place) if the server refuses
 *  - `toggleLike`         the same intent model as announcement likes
 *
 * Comment text and field errors come back as `AnnouncementError` (`fieldErrors`
 * keys: `body`, `media_path`, `media_type`).
 */

export interface ThreadState {
  items: AnnouncementComment[];
  page: number;
  lastPage: number;
  total: number;
  perPage: number;
  status: LoadStatus;
  error: AnnouncementError | null;
  loadingMore: boolean;
  loadMoreError: AnnouncementError | null;
  posting: boolean;
  postError: AnnouncementError | null;
}

export const EMPTY_THREAD: ThreadState = Object.freeze({
  items: [],
  page: 0,
  lastPage: 0,
  total: 0,
  perPage: 10,
  status: "idle",
  error: null,
  loadingMore: false,
  loadMoreError: null,
  posting: false,
  postError: null,
}) as ThreadState;

interface CommentsState {
  threads: Record<number, ThreadState>;
  /** `${announcementId}:${commentId}` -> the like state the user last chose. */
  likeIntent: Record<string, boolean>;
}

interface CommentsActions {
  load: (
    announcementId: number,
    options?: { force?: boolean },
    signal?: AbortSignal,
  ) => Promise<void>;
  loadMore: (announcementId: number, signal?: AbortSignal) => Promise<void>;
  post: (
    announcementId: number,
    input: CreateCommentPayload,
  ) => Promise<StoreResult<{ comment: AnnouncementComment }>>;
  remove: (announcementId: number, commentId: number) => Promise<StoreResult>;
  toggleLike: (announcementId: number, commentId: number) => void;
  clearPostError: (announcementId: number) => void;
  /** Forget a thread (its comments are re-fetched next time it opens). */
  reset: (announcementId: number) => void;
}

export type AnnouncementCommentsStore = CommentsState & CommentsActions;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function isCancelled(err: unknown): boolean {
  return axios.isCancel(err) || parseAnnouncementError(err).kind === "cancelled";
}

function toastError(error: AnnouncementError) {
  if (error.kind === "cancelled") return;
  toast.error(error.message);
}

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function chronological(a: AnnouncementComment, b: AnnouncementComment): number {
  const ta = Date.parse(a.created_at);
  const tb = Date.parse(b.created_at);
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
  return a.id - b.id;
}

function mergeComments(
  existing: AnnouncementComment[],
  incoming: AnnouncementComment[],
): AnnouncementComment[] {
  const ids = new Set(incoming.map((c) => c.id));
  return [...existing.filter((c) => !ids.has(c.id)), ...incoming].sort(chronological);
}

function threadOf(state: CommentsState, announcementId: number): ThreadState {
  return state.threads[announcementId] ?? EMPTY_THREAD;
}

function withThread(
  state: CommentsState,
  announcementId: number,
  patch: Partial<ThreadState> | ((thread: ThreadState) => Partial<ThreadState>),
): Pick<CommentsState, "threads"> {
  const current = threadOf(state, announcementId);
  const next = typeof patch === "function" ? patch(current) : patch;
  return {
    threads: { ...state.threads, [announcementId]: { ...current, ...next } },
  };
}

function patchComment(
  state: CommentsState,
  announcementId: number,
  commentId: number,
  patch: Partial<AnnouncementComment>,
): Pick<CommentsState, "threads"> {
  const thread = state.threads[announcementId];
  if (!thread || !thread.items.some((c) => c.id === commentId)) return { threads: state.threads };
  return withThread(state, announcementId, {
    items: thread.items.map((c) => (c.id === commentId ? { ...c, ...patch } : c)),
  });
}

const likeKey = (announcementId: number, commentId: number) =>
  `${announcementId}:${commentId}`;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Like intents (same model as the announcement store; see there)            */
/* ────────────────────────────────────────────────────────────────────────── */

const likeInflight = new Set<string>();
const likeConfirmed = new Map<string, { liked: boolean; count: number }>();

async function runLikeLoop(announcementId: number, commentId: number): Promise<void> {
  const key = likeKey(announcementId, commentId);
  likeInflight.add(key);
  try {
    for (;;) {
      let result: LikeResult;
      try {
        result = await announcementCommentsService.toggleLike(announcementId, commentId);
      } catch (err) {
        const base = likeConfirmed.get(key);
        useAnnouncementCommentsStore.setState((state) => ({
          ...(base
            ? patchComment(state, announcementId, commentId, {
                liked_by_me: base.liked,
                likes_count: base.count,
              })
            : {}),
          likeIntent: omitKey(state.likeIntent, key),
        }));
        likeConfirmed.delete(key);
        toastError(parseAnnouncementError(err, "Could not update your like."));
        return;
      }

      likeConfirmed.set(key, { liked: result.liked, count: result.likes_count });
      const intent = useAnnouncementCommentsStore.getState().likeIntent[key];

      if (intent === undefined || intent === result.liked) {
        useAnnouncementCommentsStore.setState((state) => ({
          ...patchComment(state, announcementId, commentId, {
            liked_by_me: result.liked,
            likes_count: result.likes_count,
          }),
          likeIntent: omitKey(state.likeIntent, key),
        }));
        likeConfirmed.delete(key);
        return;
      }

      useAnnouncementCommentsStore.setState((state) =>
        patchComment(state, announcementId, commentId, {
          liked_by_me: intent,
          likes_count: Math.max(0, result.likes_count + (intent ? 1 : -1)),
        }),
      );
    }
  } finally {
    likeInflight.delete(key);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/** Latest `load` per thread, so a slow older answer can't overwrite a newer one. */
const loadRequest = new Map<number, number>();

export const useAnnouncementCommentsStore = create<AnnouncementCommentsStore>()(
  (set, get) => ({
    threads: {},
    likeIntent: {},

    load: async (announcementId, options, signal) => {
      const current = threadOf(get(), announcementId);
      if (current.status === "loading") return;
      if (current.status === "success" && !options?.force) return;

      const request = (loadRequest.get(announcementId) ?? 0) + 1;
      loadRequest.set(announcementId, request);
      set((s) => withThread(s, announcementId, { status: "loading", error: null }));

      try {
        const result = await announcementCommentsService.list(
          announcementId,
          { page: 1, perPage: current.perPage },
          signal,
        );
        if (loadRequest.get(announcementId) !== request) return;
        set((s) =>
          withThread(s, announcementId, {
            items: result.items,
            page: result.page,
            lastPage: result.lastPage,
            total: result.total,
            perPage: result.perPage,
            status: "success",
            error: null,
            loadMoreError: null,
          }),
        );
      } catch (err) {
        if (loadRequest.get(announcementId) !== request) return;
        if (isCancelled(err)) {
          // Back to where it was, so the next open tries again.
          set((s) => withThread(s, announcementId, { status: current.status }));
          return;
        }
        set((s) =>
          withThread(s, announcementId, {
            status: "error",
            error: parseAnnouncementError(err, "Could not load comments."),
          }),
        );
      }
    },

    loadMore: async (announcementId, signal) => {
      const thread = threadOf(get(), announcementId);
      if (thread.loadingMore || thread.status !== "success" || thread.page >= thread.lastPage) {
        return;
      }
      const request = loadRequest.get(announcementId) ?? 0;
      set((s) => withThread(s, announcementId, { loadingMore: true, loadMoreError: null }));

      try {
        const result = await announcementCommentsService.list(
          announcementId,
          {
            // As the admin list: after a delete, "the next page" would skip a comment.
            page: Math.min(thread.page + 1, Math.floor(thread.items.length / thread.perPage) + 1),
            perPage: thread.perPage,
          },
          signal,
        );
        if ((loadRequest.get(announcementId) ?? 0) !== request) return;
        set((s) =>
          withThread(s, announcementId, (t) => ({
            items: mergeComments(t.items, result.items),
            page: result.page,
            lastPage: result.lastPage,
            total: Math.max(result.total, t.total),
            loadingMore: false,
          })),
        );
      } catch (err) {
        set((s) =>
          withThread(s, announcementId, {
            loadingMore: false,
            loadMoreError: isCancelled(err)
              ? null
              : parseAnnouncementError(err, "Could not load more comments."),
          }),
        );
      }
    },

    post: async (announcementId, input) => {
      set((s) => withThread(s, announcementId, { posting: true, postError: null }));
      try {
        const comment = await announcementCommentsService.create(announcementId, input);
        set((s) =>
          withThread(s, announcementId, (t) => ({
            posting: false,
            items: mergeComments(t.items, [comment]),
            total: t.total + 1,
            // A thread that was never opened is now "loaded" with just this one:
            // opening it must still fetch the rest, so leave `status` alone.
          })),
        );
        useAnnouncementStore.getState().adjustCommentsCount(announcementId, 1);
        return { ok: true, comment };
      } catch (err) {
        const error = parseAnnouncementError(err, "Could not post your comment.");
        set((s) => withThread(s, announcementId, { posting: false, postError: error }));
        return { ok: false, error };
      }
    },

    remove: async (announcementId, commentId) => {
      const thread = threadOf(get(), announcementId);
      const index = thread.items.findIndex((c) => c.id === commentId);
      const removed = index >= 0 ? thread.items[index] : null;

      if (removed) {
        set((s) =>
          withThread(s, announcementId, (t) => ({
            items: t.items.filter((c) => c.id !== commentId),
            total: Math.max(0, t.total - 1),
          })),
        );
      }

      try {
        await announcementCommentsService.remove(announcementId, commentId);
        useAnnouncementStore.getState().adjustCommentsCount(announcementId, -1);
        return { ok: true };
      } catch (err) {
        const error = parseAnnouncementError(err, "Could not delete the comment.");
        // 404: someone already deleted it, so it should stay gone.
        if (removed && error.kind !== "notFound") {
          set((s) =>
            withThread(s, announcementId, (t) => {
              if (t.items.some((c) => c.id === commentId)) return {};
              const items = [...t.items];
              items.splice(Math.min(index, items.length), 0, removed);
              return { items, total: t.total + 1 };
            }),
          );
        }
        toastError(error);
        return { ok: false, error };
      }
    },

    toggleLike: (announcementId, commentId) => {
      const state = get();
      const comment = state.threads[announcementId]?.items.find((c) => c.id === commentId);
      if (!comment) return;

      const key = likeKey(announcementId, commentId);
      const showing = state.likeIntent[key] ?? comment.liked_by_me;
      const desired = !showing;

      if (!likeConfirmed.has(key)) {
        likeConfirmed.set(key, { liked: comment.liked_by_me, count: comment.likes_count });
      }

      set((s) => ({
        ...patchComment(s, announcementId, commentId, {
          liked_by_me: desired,
          likes_count: Math.max(0, comment.likes_count + (desired ? 1 : -1)),
        }),
        likeIntent: { ...s.likeIntent, [key]: desired },
      }));

      if (!likeInflight.has(key)) void runLikeLoop(announcementId, commentId);
    },

    clearPostError: (announcementId) =>
      set((s) =>
        s.threads[announcementId]?.postError
          ? withThread(s, announcementId, { postError: null })
          : s,
      ),

    reset: (announcementId) =>
      set((s) => {
        if (!s.threads[announcementId]) return s;
        const threads = { ...s.threads };
        delete threads[announcementId];
        loadRequest.delete(announcementId);
        return { threads };
      }),
  }),
);

/* ────────────────────────────────────────────────────────────────────────── */
/*  Selectors                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** A thread, or a stable empty one (safe to use as a zustand selector result). */
export const selectThread =
  (announcementId: number) =>
  (s: AnnouncementCommentsStore): ThreadState =>
    s.threads[announcementId] ?? EMPTY_THREAD;
