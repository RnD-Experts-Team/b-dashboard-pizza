import { NextRequest } from "next/server";
import {
  invalidParam,
  isUuidParam,
  proxyNotifications,
} from "../../../../_lib/proxy";

/**
 * DELETE /api/announcements/media/video/uploads/:uploadUuid
 * Proxy → DELETE {NOTIFICATIONS_BASE_URL}/announcements/media/video/uploads/:uploadUuid
 * Cancels a chunked upload. Optional: abandoned uploads are cleaned up after an hour.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uploadUuid: string }> },
) {
  const { uploadUuid } = await params;
  if (!isUuidParam(uploadUuid)) return invalidParam("upload id");
  return proxyNotifications(
    request,
    `/announcements/media/video/uploads/${uploadUuid}`,
    { method: "DELETE" },
  );
}
