import { NextRequest } from "next/server";
import { proxyNotifications } from "../../../_lib/proxy";
import { invalidGifQuery } from "../../../_lib/validate";

/**
 * GET /api/announcements/media/gifs/search?q=&limit=&offset=
 * Proxy → GET {NOTIFICATIONS_BASE_URL}/announcements/media/gifs/search
 */
export async function GET(request: NextRequest) {
  const bad = invalidGifQuery(request);
  if (bad) return bad;
  return proxyNotifications(request, "/announcements/media/gifs/search", {
    method: "GET",
    query: ["q", "limit", "offset"],
  });
}
