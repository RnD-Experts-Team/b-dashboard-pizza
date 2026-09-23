import { NextRequest } from "next/server";
import { BASE_URL, proxyGet, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * Storage locations are GLOBAL, not store-scoped — note the absence of a
 * [store] segment, unlike everything else under maintenance-tickets/.
 *
 * They live under this prefix anyway because EntityNotesAttachments resolves
 * every entityPath against /api/maintenance-tickets.
 */
export async function GET(request: NextRequest) {
  const qs = new URL(request.url).searchParams.toString();
  return proxyGet(request, `${BASE_URL}/storage-locations${qs ? `?${qs}` : ""}`);
}

/** Raw passthrough: the create form may carry notes and attachments. */
export async function POST(request: NextRequest) {
  return proxyRawPost(request, `${BASE_URL}/storage-locations`);
}
