import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const { store } = await params;
  if (!store) return errorJson("MISSING_PARAM", "store is required", 400);
  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/attachments`;
  return proxyRawPost(request, upstreamUrl);
}
