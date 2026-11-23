import { NextRequest } from "next/server";
import {
  invalidParam,
  isPositiveIntParam,
  proxyNotifications,
} from "../../_lib/proxy";

/**
 * POST /api/announcements/:id/like
 * Proxy → POST {NOTIFICATIONS_BASE_URL}/announcements/:id/like
 * One toggle: call it to like, call it again to unlike. Returns { liked, likes_count }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isPositiveIntParam(id)) return invalidParam("announcement id");
  return proxyNotifications(request, `/announcements/${id}/like`, { method: "POST" });
}
