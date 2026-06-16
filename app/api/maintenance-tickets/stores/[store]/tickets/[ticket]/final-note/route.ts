import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string }> }
) {
  const { store, ticket } = await params;
  if (!store || !ticket) return errorJson("MISSING_PARAM", "store and ticket are required", 400);

  // v2.0: multipart (body, type, files[]) — forward raw so files pass through.
  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/final-note`;
  return proxyRawPost(request, upstreamUrl);
}
