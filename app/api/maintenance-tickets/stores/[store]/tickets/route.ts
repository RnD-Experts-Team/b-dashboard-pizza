import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyGet, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ store: string }> };

/**
 * A store's tickets. The query string is forwarded verbatim, so repeated
 * `statuses[]`, `stores[]`… keys reach upstream intact.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { store } = await params;
  if (!store) return errorJson("MISSING_PARAM", "store is required", 400);
  const qs = new URL(request.url).search;
  return proxyGet(request, `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets${qs}`);
}

/** Create a ticket; raw passthrough keeps the multipart boundary (issue photos). */
export async function POST(request: NextRequest, { params }: Params) {
  const { store } = await params;
  if (!store) return errorJson("MISSING_PARAM", "store is required", 400);
  return proxyRawPost(request, `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets`);
}
