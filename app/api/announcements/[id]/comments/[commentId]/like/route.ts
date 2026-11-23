import { NextRequest } from "next/server";
import {
  COMMENT_UPSTREAM,
  invalidParam,
  isPositiveIntParam,
  proxyNotifications,
} from "../../../../_lib/proxy";

/**
 * POST /api/announcements/:id/comments/:commentId/like
 * Proxy → POST {NOTIFICATIONS_BASE_URL}{COMMENT_UPSTREAM(commentId)}/like
 * A toggle, like the announcement one. Returns { liked, likes_count }.
 * See COMMENT_UPSTREAM / open question 1 in docs/ANNOUNCEMENTS.md.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id, commentId } = await params;
  if (!isPositiveIntParam(id)) return invalidParam("announcement id");
  if (!isPositiveIntParam(commentId)) return invalidParam("comment id");
  return proxyNotifications(request, `${COMMENT_UPSTREAM(commentId)}/like`, {
    method: "POST",
  });
}
