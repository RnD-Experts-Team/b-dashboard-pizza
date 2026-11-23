import { NextRequest } from "next/server";
import { proxyNotifications } from "../../../_lib/proxy";
import { invalidGifQuery } from "../../../_lib/validate";

/**
 * GET /api/announcements/media/gifs/trending?limit=&offset=
 * Proxy → GET {NOTIFICATIONS_BASE_URL}/announcements/media/gifs/trending
 * Giphy, proxied by Notifications: no API key on the client.
 */
export async function GET(request: NextRequest) {
  const bad = invalidGifQuery(request);
  if (bad) return bad;
  return proxyNotifications(request, "/announcements/media/gifs/trending", {
    method: "GET",
    query: ["limit", "offset"],
  });
}
