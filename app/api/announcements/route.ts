import { NextRequest } from "next/server";
import { proxyNotifications } from "./_lib/proxy";
import { invalidPagingQuery, validateMediaFields } from "./_lib/validate";

/**
 * GET /api/announcements?page=&per_page=
 * Proxy → GET {NOTIFICATIONS_BASE_URL}/announcements
 * Admin list: always every announcement, paginated (Laravel `{ data, links, meta }`).
 */
export async function GET(request: NextRequest) {
  const bad = invalidPagingQuery(request);
  if (bad) return bad;
  return proxyNotifications(request, "/announcements", {
    method: "GET",
    query: ["page", "per_page"],
  });
}

/**
 * POST /api/announcements
 * Proxy → POST {NOTIFICATIONS_BASE_URL}/announcements
 * Creates an announcement. Media goes in as `media_path`, never `media_url`.
 */
export async function POST(request: NextRequest) {
  return proxyNotifications(request, "/announcements", {
    method: "POST",
    body: "json",
    validateJson: validateMediaFields,
  });
}
