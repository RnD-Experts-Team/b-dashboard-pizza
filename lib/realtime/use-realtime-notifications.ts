/**
 * useRealtimeNotifications
 *
 * React hook that subscribes to a private Reverb/Pusher channel for the
 * current authenticated user and listens for real-time notification events.
 *
 * When a `.notification.created` event arrives the hook:
 *   1. Pushes the notification into the Zustand store.
 *   2. Shows a toast via showNotificationToast().
 *
 * The WebSocket connection is established once the user is authenticated
 * (token + userId are available) and torn down when the component/hook
 * unmounts or when credentials change.
 */

"use client";

import { useEffect, useRef } from "react";
import type Echo from "laravel-echo";
import { createEchoInstance } from "@/lib/realtime/echo";
import { useNotificationStore } from "@/lib/store/notification.store";
import { showNotificationToast } from "@/components/notifications/notification-toast";
import type { Notification } from "@/types/notification.types";

interface UseRealtimeNotificationsParams {
  /** Bearer token of the authenticated user */
  token: string | null;
  /** Numeric or string user ID — used to build the private channel name */
  userId: string | number | null;
}

export function useRealtimeNotifications({
  token,
  userId,
}: UseRealtimeNotificationsParams) {
  // Keep a ref to the Echo instance so we can disconnect on cleanup
  const echoRef = useRef<Echo<"pusher"> | null>(null);

  useEffect(() => {
    // ── Guard: only connect when we have both token and userId ────────
    if (!token || !userId) return;

    // ── Defer connection by one tick so React 19 Strict Mode's
    //    immediate mount→unmount→remount cycle doesn't open a WebSocket
    //    only to close it before the handshake completes. ──────────────
    let echo: Echo<"pusher"> | null = null;
    let cancelled = false;

    const timer = setTimeout(() => {
      if (cancelled) return;

      // ── Create the Laravel Echo instance ────────────────────────────
      echo = createEchoInstance(token);
      echoRef.current = echo;

      // ── Connection-level logging (dev convenience) ──────────────────
      const pusher = echo.connector.pusher;

      pusher.connection.bind("connected", () => {
        console.log("[Reverb] WebSocket connected");
      });

      pusher.connection.bind("error", (err: unknown) => {
        console.error("[Reverb] WebSocket connection error:", err);
      });

      pusher.connection.bind("disconnected", () => {
        console.warn("[Reverb] WebSocket disconnected");
      });

      // ── Subscribe to the user's private channel ────────────────────
      // Channel name matches backend: private-users.{userId}
      const channel = echo.private(`users.${userId}`);

      channel
        .subscribed(() => {
          console.log(`[Reverb] Subscribed to private-users.${userId}`);
        })
        .error((err: unknown) => {
          console.error("[Reverb] Subscription error:", err);
        })
        // Listen for the notification.created event broadcast by the backend
        .listen(".notification.created", (event: Notification) => {
          console.log("[Reverb] Notification received:", event);

          // Push into the store so the bell badge & panel update instantly
          useNotificationStore.getState().addNotification(event);

          // Show a slide-in toast so the user notices immediately
          showNotificationToast(event);
        });
    }, 0);

    // ── Cleanup: cancel pending timer or disconnect if already connected
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (echo) {
        echo.leave(`users.${userId}`);
        echo.disconnect();
        echoRef.current = null;
        console.log("[Reverb] Disconnected & cleaned up");
      }
    };
  }, [token, userId]);
}
