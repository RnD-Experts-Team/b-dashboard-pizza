import { NextRequest } from "next/server";
import { proxyNotifications } from "../_lib/proxy";

/**
 * GET /api/announcements/unseen
 * Proxy → GET {NOTIFICATIONS_BASE_URL}/announcements/unseen
 * Active announcements this user has not marked seen, oldest first.
 */
export async function GET(request: NextRequest) {
  return proxyNotifications(request, "/announcements/unseen", { method: "GET" });
}
