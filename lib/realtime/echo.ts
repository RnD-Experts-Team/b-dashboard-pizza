/**
 * Laravel Echo / Reverb Configuration
 *
 * Sets up a Laravel Echo instance backed by Pusher JS that connects to
 * a Laravel Reverb WebSocket server. The connection uses the Pusher
 * protocol over WSS for real-time broadcasting.
 *
 * Environment variables (all optional — sensible defaults are provided):
 *   NEXT_PUBLIC_REVERB_KEY            — Reverb app key
 *   NEXT_PUBLIC_REVERB_WS_HOST        — WebSocket host
 *   NEXT_PUBLIC_REVERB_AUTH_ENDPOINT   — Broadcasting auth endpoint
 */

import Echo from "laravel-echo";
import Pusher from "pusher-js";

// ─── Expose Pusher globally — Laravel Echo expects window.Pusher ─────────
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).Pusher = Pusher;
}

// ─── Configuration constants ─────────────────────────────────────────────

/** Reverb application key (constant across environments) */
const REVERB_KEY =
  process.env.NEXT_PUBLIC_REVERB_KEY || "rvb_7YpQ2mL8xN4kV9sD";

/** WebSocket host — Reverb WS endpoint (no protocol prefix) */
const WS_HOST =
  process.env.NEXT_PUBLIC_REVERB_WS_HOST ||
  "ws.notificationstesting.lcportal.cloud";

/** Broadcasting auth endpoint — verifies private-channel subscriptions */
const AUTH_ENDPOINT =
  process.env.NEXT_PUBLIC_REVERB_AUTH_ENDPOINT ||
  "https://notificationstesting.lcportal.cloud/api/broadcasting/auth";

// ─── Factory ─────────────────────────────────────────────────────────────

/**
 * Create a configured Laravel Echo instance.
 *
 * @param token  Bearer token for the authenticated user.
 *               Passed in the Authorization header when Echo hits
 *               the broadcasting/auth endpoint.
 */
export function createEchoInstance(token: string): Echo<"pusher"> {
  return new Echo({
    broadcaster: "pusher",

    // Reverb app key — identifies this app on the Reverb server
    key: REVERB_KEY,

    // Pusher JS requires a cluster value even though Reverb ignores it
    cluster: "mt1",

    // ── WebSocket transport ─────────────────────────────────────────
    wsHost: WS_HOST,
    wsPort: 80,
    wssPort: 443,
    forceTLS: true,                // always use wss://
    disableStats: true,            // no Pusher usage stats
    enabledTransports: ["ws", "wss"],

    // ── Private-channel authentication ──────────────────────────────
    authEndpoint: AUTH_ENDPOINT,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  });
}
