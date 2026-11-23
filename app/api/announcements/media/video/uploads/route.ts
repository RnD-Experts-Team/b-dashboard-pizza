import { NextRequest } from "next/server";
import { proxyNotifications } from "../../../_lib/proxy";

/**
 * POST /api/announcements/media/video/uploads
 * Body: { total_chunks, total_size, original_filename }
 * Proxy → POST {NOTIFICATIONS_BASE_URL}/announcements/media/video/uploads
 * Init of a chunked video upload. 422 when the size or type is refused.
 */
export async function POST(request: NextRequest) {
  return proxyNotifications(request, "/announcements/media/video/uploads", {
    method: "POST",
    body: "json",
  });
}
