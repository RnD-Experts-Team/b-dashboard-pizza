import { NextRequest } from "next/server";
import { proxyNotifications } from "../_lib/proxy";

/**
 * GET /api/announcements/visible
 * Proxy → GET {NOTIFICATIONS_BASE_URL}/announcements/visible
 * Currently active announcements for this user, with seen / like state.
 */
export async function GET(request: NextRequest) {
  return proxyNotifications(request, "/announcements/visible", { method: "GET" });
}
