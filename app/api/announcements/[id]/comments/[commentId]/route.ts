import { NextRequest } from "next/server";
import {
  COMMENT_UPSTREAM,
  invalidParam,
  isPositiveIntParam,
  proxyNotifications,
} from "../../../_lib/proxy";

/**
 * DELETE /api/announcements/:id/comments/:commentId
 * Proxy → DELETE {NOTIFICATIONS_BASE_URL}{COMMENT_UPSTREAM(commentId)}
 * Only the author may delete (403 otherwise).
 *
 * The announcement id is validated but not used upstream: the backend contract
 * addresses a comment by its own id. See COMMENT_UPSTREAM and open question 1
 * in docs/ANNOUNCEMENTS.md.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id, commentId } = await params;
  if (!isPositiveIntParam(id)) return invalidParam("announcement id");
  if (!isPositiveIntParam(commentId)) return invalidParam("comment id");
  return proxyNotifications(request, COMMENT_UPSTREAM(commentId), { method: "DELETE" });
}
