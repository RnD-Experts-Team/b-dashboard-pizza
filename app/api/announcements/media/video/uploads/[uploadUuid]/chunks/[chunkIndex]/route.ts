import { NextRequest } from "next/server";
import {
  invalidParam,
  isNonNegativeIntParam,
  isUuidParam,
  CHUNK_MAX_BYTES,
  proxyNotifications,
  UPLOAD_TIMEOUT_MS,
} from "@/app/api/announcements/_lib/proxy";

/**
 * POST /api/announcements/media/video/uploads/:uploadUuid/chunks/:chunkIndex
 * Body: multipart/form-data, field "chunk" (binary) plus optional
 * width / height / duration_seconds (remembered server-side).
 * Proxy → POST {NOTIFICATIONS_BASE_URL}/announcements/media/video/uploads/:uploadUuid/chunks/:chunkIndex
 *
 * The last chunk's answer is the one that assembles the file, hence the long timeout.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uploadUuid: string; chunkIndex: string }> },
) {
  const { uploadUuid, chunkIndex } = await params;
  if (!isUuidParam(uploadUuid)) return invalidParam("upload id");
  if (!isNonNegativeIntParam(chunkIndex)) return invalidParam("chunk index");
  return proxyNotifications(
    request,
    `/announcements/media/video/uploads/${uploadUuid}/chunks/${chunkIndex}`,
    { method: "POST", body: "multipart", timeoutMs: UPLOAD_TIMEOUT_MS, maxBytes: CHUNK_MAX_BYTES },
  );
}
