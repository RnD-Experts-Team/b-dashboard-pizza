import { NextRequest } from "next/server";
import {
  invalidParam,
  isPositiveIntParam,
  proxyNotifications,
} from "../../_lib/proxy";
import { invalidPagingQuery, validateMediaFields } from "../../_lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/announcements/:id/comments?page=&per_page=
 * Proxy → GET {NOTIFICATIONS_BASE_URL}/announcements/:id/comments
 * Paginated, oldest first.
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isPositiveIntParam(id)) return invalidParam("announcement id");
  const bad = invalidPagingQuery(request);
  if (bad) return bad;
  return proxyNotifications(request, `/announcements/${id}/comments`, {
    method: "GET",
    query: ["page", "per_page"],
  });
}

/**
 * POST /api/announcements/:id/comments
 * Body: { body?, media_path?, media_type?: "image" | "gif" } (at least one of body / media)
 * Proxy → POST {NOTIFICATIONS_BASE_URL}/announcements/:id/comments
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isPositiveIntParam(id)) return invalidParam("announcement id");
  return proxyNotifications(request, `/announcements/${id}/comments`, {
    method: "POST",
    body: "json",
    validateJson: validateMediaFields,
  });
}
