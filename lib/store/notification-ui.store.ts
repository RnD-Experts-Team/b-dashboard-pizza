import { create } from "zustand";
import type { Notification } from "@/types/notification.types";
import { useNotificationStore } from "@/lib/store/notification.store";

/**
 * What the notification UI is showing: the persistent toast stack and the
 * bell's drawer. The notifications themselves (list, unread count, read state)
 * stay in `notification.store.ts`.
 *
 * Rules:
 * - A toast stays until it is dismissed, opened, or its notification is read
 *   anywhere (row click, "Mark all as read") — there is no timer.
 * - Newest first: `toasts[0]` is the card on top of the stack.
 * - While the drawer is open no toast is queued (the list already shows it);
 *   the new row is flagged in `arrivedIds` so it can flash its colour once.
 * - Opening the drawer clears the stack: everything in it is in the list.
 * - Memory only: a reload drops pending toasts; they stay unread in the list.
 */

interface NotificationUiState {
  toasts: Notification[];
  drawerOpen: boolean;
  /** Ids that arrived while the drawer was open (flash once). Reset on close. */
  arrivedIds: number[];
}

interface NotificationUiActions {
  /** A notification just arrived over the WebSocket. */
  pushToast: (notification: Notification) => void;
  /** X or swipe on the top card: only that one goes. */
  dismissTop: () => void;
  removeToast: (id: number) => void;
  clearToasts: () => void;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
}

export const useNotificationUiStore = create<NotificationUiState & NotificationUiActions>()(
  (set, get) => ({
    toasts: [],
    drawerOpen: false,
    arrivedIds: [],

    pushToast: (notification) => {
      // Read = it has a timestamp. A live event that omits `read_at` is unread.
      if (notification.read_at) return;
      if (get().drawerOpen) {
        set((s) => ({ arrivedIds: [...s.arrivedIds, notification.id] }));
        return;
      }
      set((s) => ({
        toasts: [notification, ...s.toasts.filter((t) => t.id !== notification.id)],
      }));
    },

    dismissTop: () => set((s) => ({ toasts: s.toasts.slice(1) })),

    removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    clearToasts: () => set({ toasts: [] }),

    setDrawerOpen: (open) =>
      set(open ? { drawerOpen: true, toasts: [] } : { drawerOpen: false, arrivedIds: [] }),

    toggleDrawer: () => get().setDrawerOpen(!get().drawerOpen),
  })
);

// A toast whose notification got read elsewhere has nothing left to say.
useNotificationStore.subscribe((state) => {
  const { toasts } = useNotificationUiStore.getState();
  if (toasts.length === 0) return;
  const read = new Set(
    state.notifications.filter((n) => !!n.read_at).map((n) => n.id)
  );
  const left = toasts.filter((t) => !read.has(t.id));
  if (left.length !== toasts.length) useNotificationUiStore.setState({ toasts: left });
});
