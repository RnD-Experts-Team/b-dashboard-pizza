import { create } from "zustand";
import axios from "axios";
import { toast } from "sonner";
import type {
  Announcement,
  CreateAnnouncementPayload,
  LikeResult,
  UpdateAnnouncementPayload,
} from "@/types/announcement.types";
import { announcementService } from "@/lib/api/services/announcement.service";
import {
  parseAnnouncementError,
  type AnnouncementError,
} from "@/lib/announcements/errors";

/**
 * Announcements store.
 *
 * Three separate slices, so the views stop overwriting each other (v1 had one
 * `announcements` array that the admin list and the user feed both replaced):
 *
 *  - `feed`    the visible announcements (the user page)
 *  - `admin`   the paged admin list (`loadAdmin` + `loadMoreAdmin`)
 *  - `unseen`  the queue behind the on-load popup (`loadUnseen`,
 *              `acknowledgeCurrent`)
 *
 * "Seen" flags stay in sync both ways between the queue and the feed.
 * Likes use an intent model (see `toggleLike`). Create / update / delete /
 * mark-seen return `{ ok }` / `{ ok: false, error }` so a dialog can show the
 * backend's own message; the optimistic ones (like, seen) also toast it.
 */

export type LoadStatus = "idle" | "loading" | "success" | "error";

export type StoreResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: AnnouncementError };

export interface FeedSlice {
  items: Announcement[];
  status: LoadStatus;
  error: AnnouncementError | null;
}

export interface AdminSlice {
  items: Announcement[];
  page: number;
  lastPage: number;
  total: number;
  perPage: number;
  status: LoadStatus;
  error: AnnouncementError | null;
  loadingMore: boolean;
  /** A failed "load more" keeps the loaded rows and says why. */
  loadMoreError: AnnouncementError | null;
}

export interface UnseenSlice {
  /** Oldest first. The popup shows `queue[0]`. */
  queue: Announcement[];
  status: LoadStatus;
  error: AnnouncementError | null;
}

interface AnnouncementStoreState {
  feed: FeedSlice;
  admin: AdminSlice;
  unseen: UnseenSlice;

  /** The state the user last chose for each announcement they tapped like on. */
  likeIntent: Record<number, boolean>;

  isMarkingSeen: boolean;
  isCreating: boolean;
  createError: AnnouncementError | null;
  isUpdating: boolean;
  updateError: AnnouncementError | null;
  isDeleting: boolean;
  deleteError: AnnouncementError | null;
}

interface AnnouncementStoreActions {
  loadFeed: (signal?: AbortSignal) => Promise<void>;
  loadAdmin: (options?: { perPage?: number }, signal?: AbortSignal) => Promise<void>;
  loadMoreAdmin: (signal?: AbortSignal) => Promise<void>;
  loadUnseen: (signal?: AbortSignal) => Promise<void>;

  /** Mark the popup's current item seen and advance to the next. Never blocks the queue. */
  acknowledgeCurrent: () => Promise<StoreResult>;
  /** Mark announcements seen (feed buttons). Optimistic, rolled back on failure. */
  markSeen: (ids: number[]) => Promise<StoreResult>;

  /** Like / unlike with the intent model. Resolves immediately; the UI reads the item. */
  toggleLike: (id: number) => void;

  createAnnouncement: (
    payload: CreateAnnouncementPayload,
  ) => Promise<StoreResult<{ announcement: Announcement }>>;
  updateAnnouncement: (
    id: number,
    payload: UpdateAnnouncementPayload,
  ) => Promise<StoreResult<{ announcement: Announcement }>>;
  deleteAnnouncement: (id: number) => Promise<StoreResult>;

  /** Keep a post's `comments_count` right (only when the backend sends one). */
  adjustCommentsCount: (id: number, delta: number) => void;
  clearActionErrors: () => void;
}

export type AnnouncementStore = AnnouncementStoreState & AnnouncementStoreActions;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const DEFAULT_ADMIN_PER_PAGE = 15;

const emptyAdmin: AdminSlice = {
  items: [],
  page: 0,
  lastPage: 0,
  total: 0,
  perPage: DEFAULT_ADMIN_PER_PAGE,
  status: "idle",
  error: null,
  loadingMore: false,
  loadMoreError: null,
};

/** Cancelled requests (unmount, a newer load) are not failures. */
function isCancelled(err: unknown): boolean {
  return axios.isCancel(err) || parseAnnouncementError(err).kind === "cancelled";
}

function byCreatedAtAsc(a: Announcement, b: Announcement): number {
  const ta = Date.parse(a.created_at);
  const tb = Date.parse(b.created_at);
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
  return a.id - b.id;
}

/** Add `incoming` to `existing`, replacing rows with the same id, keeping order. */
function mergeById(existing: Announcement[], incoming: Announcement[]): Announcement[] {
  const seen = new Set(incoming.map((a) => a.id));
  return [...existing.filter((a) => !seen.has(a.id)), ...incoming];
}

type Patch = Partial<Announcement>;

/** Apply `patch` to the item with `id` in every slice. */
function patchEverywhere(
  state: AnnouncementStoreState,
  id: number,
  patch: Patch,
): Pick<AnnouncementStoreState, "feed" | "admin" | "unseen"> {
  const apply = (items: Announcement[]) =>
    items.some((a) => a.id === id)
      ? items.map((a) => (a.id === id ? { ...a, ...patch } : a))
      : items;
  return {
    feed: { ...state.feed, items: apply(state.feed.items) },
    admin: { ...state.admin, items: apply(state.admin.items) },
    unseen: { ...state.unseen, queue: apply(state.unseen.queue) },
  };
}

function findItem(state: AnnouncementStoreState, id: number): Announcement | undefined {
  return (
    state.feed.items.find((a) => a.id === id) ??
    state.admin.items.find((a) => a.id === id) ??
    state.unseen.queue.find((a) => a.id === id)
  );
}

function omitKey<T>(record: Record<number, T>, key: number): Record<number, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function toastError(error: AnnouncementError) {
  if (error.kind === "cancelled") return;
  toast.error(error.message);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Like intents                                                              */
/*                                                                            */
/*  The server only has a TOGGLE, so a fast double tap would otherwise leave  */
/*  the server and the screen disagreeing. Instead:                           */
/*   - `likeIntent[id]` is the state the user last chose; the UI shows it     */
/*     at once (the item's fields are updated optimistically);                */
/*   - at most ONE request is in flight per id;                               */
/*   - when it settles, the answer {liked, likes_count} is reconciled with    */
/*     the latest intent: if they differ, ONE more toggle is sent;            */
/*   - on error, only that item's like fields go back to the last state the   */
/*     server confirmed, in every slice.                                      */
/* ────────────────────────────────────────────────────────────────────────── */

const likeInflight = new Set<number>();
/** The last state the server confirmed, captured before the first optimistic change. */
const likeConfirmed = new Map<number, { liked: boolean; count: number }>();

async function runLikeLoop(id: number): Promise<void> {
  likeInflight.add(id);
  try {
    for (;;) {
      let result: LikeResult;
      try {
        result = await announcementService.toggleLike(id);
      } catch (err) {
        const base = likeConfirmed.get(id);
        useAnnouncementStore.setState((state) => {
          return {
            ...(base
              ? patchEverywhere(state, id, {
                  liked_by_me: base.liked,
                  likes_count: base.count,
                })
              : {}),
            likeIntent: omitKey(state.likeIntent, id),
          };
        });
        likeConfirmed.delete(id);
        toastError(parseAnnouncementError(err, "Could not update your like."));
        return;
      }

      likeConfirmed.set(id, { liked: result.liked, count: result.likes_count });
      const intent = useAnnouncementStore.getState().likeIntent[id];

      if (intent === undefined || intent === result.liked) {
        // Settled: the server and the user agree.
        useAnnouncementStore.setState((state) => {
          return {
            ...patchEverywhere(state, id, {
              liked_by_me: result.liked,
              likes_count: result.likes_count,
            }),
            likeIntent: omitKey(state.likeIntent, id),
          };
        });
        likeConfirmed.delete(id);
        return;
      }

      // They changed their mind while the request was in flight. Keep showing
      // their choice (over the fresh count) and send one more toggle.
      useAnnouncementStore.setState((state) =>
        patchEverywhere(state, id, {
          liked_by_me: intent,
          likes_count: Math.max(0, result.likes_count + (intent ? 1 : -1)),
        }),
      );
    }
  } finally {
    likeInflight.delete(id);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

let feedRequest = 0;
let adminRequest = 0;
let unseenRequest = 0;
/** Ids whose mark-seen request is in flight, so a double click sends one. */
const seenInflight = new Set<number>();

export const useAnnouncementStore = create<AnnouncementStore>()((set, get) => ({
  feed: { items: [], status: "idle", error: null },
  admin: emptyAdmin,
  unseen: { queue: [], status: "idle", error: null },
  likeIntent: {},

  isMarkingSeen: false,
  isCreating: false,
  createError: null,
  isUpdating: false,
  updateError: null,
  isDeleting: false,
  deleteError: null,

  /* ── Loading ───────────────────────────────────────────────────────── */

  loadFeed: async (signal) => {
    const request = ++feedRequest;
    set((s) => ({ feed: { ...s.feed, status: "loading", error: null } }));
    try {
      const items = await announcementService.getVisibleAnnouncements(signal);
      if (request !== feedRequest) return;
      set((s) => {
        // Sync both ways: anything the feed says is seen leaves the popup queue.
        const seenIds = new Set(items.filter((a) => a.seen).map((a) => a.id));
        return {
          feed: { items, status: "success", error: null },
          unseen: seenIds.size
            ? { ...s.unseen, queue: s.unseen.queue.filter((a) => !seenIds.has(a.id)) }
            : s.unseen,
        };
      });
    } catch (err) {
      if (request !== feedRequest) return;
      if (isCancelled(err)) {
        set((s) => ({
          feed: { ...s.feed, status: s.feed.items.length > 0 ? "success" : "idle" },
        }));
        return;
      }
      set((s) => ({
        feed: {
          ...s.feed,
          status: "error",
          error: parseAnnouncementError(err, "Could not load announcements."),
        },
      }));
    }
  },

  loadAdmin: async (options, signal) => {
    const request = ++adminRequest;
    const perPage = options?.perPage ?? get().admin.perPage ?? DEFAULT_ADMIN_PER_PAGE;
    set((s) => ({
      admin: { ...s.admin, status: "loading", error: null, loadMoreError: null, perPage },
    }));
    try {
      const result = await announcementService.listAdmin({ page: 1, perPage }, signal);
      if (request !== adminRequest) return;
      set({
        admin: {
          items: result.items,
          page: result.page,
          lastPage: result.lastPage,
          total: result.total,
          perPage: result.perPage,
          status: "success",
          error: null,
          loadingMore: false,
          loadMoreError: null,
        },
      });
    } catch (err) {
      if (request !== adminRequest) return;
      if (isCancelled(err)) {
        set((s) => ({
          admin: { ...s.admin, status: s.admin.page > 0 ? "success" : "idle" },
        }));
        return;
      }
      set((s) => ({
        admin: {
          ...s.admin,
          status: "error",
          error: parseAnnouncementError(err, "Could not load announcements."),
        },
      }));
    }
  },

  loadMoreAdmin: async (signal) => {
    const { admin } = get();
    if (admin.loadingMore || admin.status !== "success" || admin.page >= admin.lastPage) return;
    const request = adminRequest;
    set((s) => ({ admin: { ...s.admin, loadingMore: true, loadMoreError: null } }));
    try {
      // After a delete the server's pages have shifted up by one, so "the next page"
      // would skip a row. Start at the page that holds the first row we lack
      // (rows already loaded are dropped by `mergeById`).
      const nextPage = Math.min(admin.page + 1, Math.floor(admin.items.length / admin.perPage) + 1);
      const result = await announcementService.listAdmin(
        { page: nextPage, perPage: admin.perPage },
        signal,
      );
      if (request !== adminRequest) return;
      set((s) => ({
        admin: {
          ...s.admin,
          items: mergeById(s.admin.items, result.items),
          page: result.page,
          lastPage: result.lastPage,
          total: result.total,
          loadingMore: false,
        },
      }));
    } catch (err) {
      if (request !== adminRequest) return;
      set((s) => ({
        admin: {
          ...s.admin,
          loadingMore: false,
          loadMoreError: isCancelled(err)
            ? null
            : parseAnnouncementError(err, "Could not load more announcements."),
        },
      }));
    }
  },

  loadUnseen: async (signal) => {
    const request = ++unseenRequest;
    set((s) => ({ unseen: { ...s.unseen, status: "loading", error: null } }));
    try {
      const items = await announcementService.getUnseenAnnouncements(signal);
      if (request !== unseenRequest) return;
      const queue = items.filter((a) => !a.seen).sort(byCreatedAtAsc);
      set((s) => {
        // Sync both ways: the server says these are unseen, so the feed must too.
        const unseenIds = new Set(queue.map((a) => a.id));
        return {
          unseen: { queue, status: "success", error: null },
          feed: unseenIds.size
            ? {
                ...s.feed,
                items: s.feed.items.map((a) =>
                  unseenIds.has(a.id) && a.seen ? { ...a, seen: false } : a,
                ),
              }
            : s.feed,
        };
      });
    } catch (err) {
      if (request !== unseenRequest) return;
      if (isCancelled(err)) {
        set((s) => ({
          unseen: { ...s.unseen, status: s.unseen.queue.length > 0 ? "success" : "idle" },
        }));
        return;
      }
      // The popup never blocks: a failed fetch is silent.
      set((s) => ({
        unseen: {
          ...s.unseen,
          status: "error",
          error: parseAnnouncementError(err, "Could not load new announcements."),
        },
      }));
    }
  },

  /* ── Seen ──────────────────────────────────────────────────────────── */

  acknowledgeCurrent: async () => {
    const head = get().unseen.queue[0];
    if (!head) return { ok: true };
    if (seenInflight.has(head.id)) return { ok: true };
    seenInflight.add(head.id);

    // Advance first: the popup must never wait on, or be stuck behind, a request.
    set((s) => ({
      unseen: { ...s.unseen, queue: s.unseen.queue.slice(1) },
      feed: {
        ...s.feed,
        items: s.feed.items.map((a) => (a.id === head.id ? { ...a, seen: true } : a)),
      },
    }));

    try {
      await announcementService.markAnnouncementsSeen([head.id]);
      return { ok: true };
    } catch (err) {
      const error = parseAnnouncementError(err, "Could not mark the announcement as read.");
      // It is not seen on the server, so the feed shouldn't claim it is.
      set((s) => ({
        feed: {
          ...s.feed,
          items: s.feed.items.map((a) => (a.id === head.id ? { ...a, seen: false } : a)),
        },
      }));
      toastError(error);
      return { ok: false, error };
    } finally {
      seenInflight.delete(head.id);
    }
  },

  markSeen: async (ids) => {
    const wanted = [...new Set(ids)].filter((id) => !seenInflight.has(id));
    if (wanted.length === 0) return { ok: true };
    wanted.forEach((id) => seenInflight.add(id));

    // Remember what was unread so a failure can put it back.
    const wasUnread = new Set(
      get()
        .feed.items.filter((a) => wanted.includes(a.id) && !a.seen)
        .map((a) => a.id),
    );

    set((s) => ({
      isMarkingSeen: true,
      feed: {
        ...s.feed,
        items: s.feed.items.map((a) => (wanted.includes(a.id) ? { ...a, seen: true } : a)),
      },
      unseen: { ...s.unseen, queue: s.unseen.queue.filter((a) => !wanted.includes(a.id)) },
    }));

    try {
      await announcementService.markAnnouncementsSeen(wanted);
      set({ isMarkingSeen: false });
      return { ok: true };
    } catch (err) {
      const error = parseAnnouncementError(err, "Could not mark as read.");
      set((s) => ({
        isMarkingSeen: false,
        feed: {
          ...s.feed,
          items: s.feed.items.map((a) => (wasUnread.has(a.id) ? { ...a, seen: false } : a)),
        },
      }));
      toastError(error);
      return { ok: false, error };
    } finally {
      wanted.forEach((id) => seenInflight.delete(id));
    }
  },

  /* ── Likes ─────────────────────────────────────────────────────────── */

  toggleLike: (id) => {
    const state = get();
    const item = findItem(state, id);
    if (!item) return;

    const showing = state.likeIntent[id] ?? item.liked_by_me ?? false;
    const desired = !showing;
    const count = item.likes_count ?? 0;

    if (!likeConfirmed.has(id)) {
      // The server's truth before any optimistic change: where a rollback lands.
      likeConfirmed.set(id, { liked: item.liked_by_me ?? false, count });
    }

    set((s) => ({
      ...patchEverywhere(s, id, {
        liked_by_me: desired,
        likes_count: Math.max(0, count + (desired ? 1 : -1)),
      }),
      likeIntent: { ...s.likeIntent, [id]: desired },
    }));

    // One request in flight per id: the running loop picks the new intent up.
    if (!likeInflight.has(id)) void runLikeLoop(id);
  },

  /* ── Admin writes ──────────────────────────────────────────────────── */

  createAnnouncement: async (payload) => {
    set({ isCreating: true, createError: null });
    try {
      const announcement = await announcementService.createAnnouncement(payload);
      set((s) => ({
        isCreating: false,
        admin: {
          ...s.admin,
          items: mergeById([announcement], s.admin.items),
          total: s.admin.total + 1,
        },
      }));
      return { ok: true, announcement };
    } catch (err) {
      const error = parseAnnouncementError(err, "Could not create the announcement.");
      set({ isCreating: false, createError: error });
      return { ok: false, error };
    }
  },

  updateAnnouncement: async (id, payload) => {
    set({ isUpdating: true, updateError: null });
    try {
      const updated = await announcementService.updateAnnouncement(id, payload);
      set((s) => {
        // The PUT answer may not carry seen / like fields: keep what we know.
        const merge = (a: Announcement) => (a.id === id ? { ...a, ...updated } : a);
        return {
          isUpdating: false,
          feed: { ...s.feed, items: s.feed.items.map(merge) },
          admin: { ...s.admin, items: s.admin.items.map(merge) },
          unseen: { ...s.unseen, queue: s.unseen.queue.map(merge) },
        };
      });
      return { ok: true, announcement: updated };
    } catch (err) {
      const error = parseAnnouncementError(err, "Could not update the announcement.");
      set({ isUpdating: false, updateError: error });
      return { ok: false, error };
    }
  },

  deleteAnnouncement: async (id) => {
    set({ isDeleting: true, deleteError: null });
    try {
      await announcementService.deleteAnnouncement(id);
      set((s) => ({
        isDeleting: false,
        feed: { ...s.feed, items: s.feed.items.filter((a) => a.id !== id) },
        admin: {
          ...s.admin,
          items: s.admin.items.filter((a) => a.id !== id),
          total: s.admin.items.some((a) => a.id === id)
            ? Math.max(0, s.admin.total - 1)
            : s.admin.total,
        },
        unseen: { ...s.unseen, queue: s.unseen.queue.filter((a) => a.id !== id) },
      }));
      return { ok: true };
    } catch (err) {
      const error = parseAnnouncementError(err, "Could not delete the announcement.");
      set({ isDeleting: false, deleteError: error });
      return { ok: false, error };
    }
  },

  /* ── Misc ──────────────────────────────────────────────────────────── */

  adjustCommentsCount: (id, delta) => {
    const item = findItem(get(), id);
    if (!item || typeof item.comments_count !== "number") return;
    set((s) => patchEverywhere(s, id, { comments_count: Math.max(0, (item.comments_count ?? 0) + delta) }));
  },

  clearActionErrors: () =>
    set({ createError: null, updateError: null, deleteError: null }),
}));

/* ────────────────────────────────────────────────────────────────────────── */
/*  Selectors                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** The announcement the popup shows now, or undefined when the queue is empty. */
export const selectCurrentUnseen = (s: AnnouncementStore): Announcement | undefined =>
  s.unseen.queue[0];

/** How many unread announcements the feed holds. */
export const selectUnreadCount = (s: AnnouncementStore): number =>
  s.feed.items.reduce((n, a) => (a.seen ? n : n + 1), 0);
