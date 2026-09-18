import { NextRequest } from "next/server";
import {
  BASE_URL,
  errorJson,
  proxyGet,
  proxyJsonPost,
} from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * How one storage location addresses the space inside it.
 *
 * A location answers "Storage A"; its levels — Shelf, Row, Column, Section —
 * and the values declared on each answer "shelf C, row 8, column 5".
 *
 * The segment is `[id]` rather than `[storageLocation]` to match its siblings
 * here: Next.js refuses two different dynamic names at the same level and the
 * rest of this folder already chose `[id]`. Upstream names it
 * `{storageLocation}`; the mapping happens in the URL built below.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return errorJson("MISSING_PARAM", "id is required", 400);

  const qs = new URL(request.url).searchParams.toString();

  return proxyGet(
    request,
    `${BASE_URL}/storage-locations/${encodeURIComponent(id)}/place-levels${qs ? `?${qs}` : ""}`
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return errorJson("MISSING_PARAM", "id is required", 400);

  return proxyJsonPost(
    request,
    `${BASE_URL}/storage-locations/${encodeURIComponent(id)}/place-levels`
  );
}
