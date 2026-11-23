import { NextRequest } from "next/server";
import { IMAGE_MAX_BYTES, proxyNotifications, UPLOAD_TIMEOUT_MS } from "../../_lib/proxy";

/**
 * POST /api/announcements/media/image
 * Body: multipart/form-data, field "media" (jpg / jpeg / png / webp / gif, 10 MB)
 * Proxy → POST {NOTIFICATIONS_BASE_URL}/announcements/media/image
 * Returns { media_path, media_url, media_type }. Also used for comment images
 * (open question 6 in docs/ANNOUNCEMENTS.md).
 */
export async function POST(request: NextRequest) {
  return proxyNotifications(request, "/announcements/media/image", {
    method: "POST",
    body: "multipart",
    timeoutMs: UPLOAD_TIMEOUT_MS,
    maxBytes: IMAGE_MAX_BYTES,
  });
}
