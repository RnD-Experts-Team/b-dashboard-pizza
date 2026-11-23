import { NextRequest } from "next/server";
import { proxyNotifications } from "../_lib/proxy";

/**
 * POST /api/announcements/mark-seen
 * Body: { announcement_ids: number[] }
 * Proxy → POST {NOTIFICATIONS_BASE_URL}/announcements/mark-seen
 */
export async function POST(request: NextRequest) {
  return proxyNotifications(request, "/announcements/mark-seen", {
    method: "POST",
    body: "json",
  });
}
