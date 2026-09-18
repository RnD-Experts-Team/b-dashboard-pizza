import { NextRequest } from "next/server";
import {
  BASE_URL,
  errorJson,
  proxyGet,
  proxyJsonPost,
} from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * The named places inside one storage location.
 *
 * The segment is `[id]` rather than `[storageLocation]` to match its siblings
 * here -- Next.js refuses two different dynamic names at the same level, and
 * the rest of this folder already chose `[id]`. Upstream names it
 * `{storageLocation}`; the mapping happens in the URL built below.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return errorJson("MISSING_PARAM", "id is required", 400);

  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();

  return proxyGet(
    request,
    `${BASE_URL}/storage-locations/${encodeURIComponent(id)}/slots${qs ? `?${qs}` : ""}`
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return errorJson("MISSING_PARAM", "id is required", 400);

  return proxyJsonPost(request, `${BASE_URL}/storage-locations/${encodeURIComponent(id)}/slots`);
}
