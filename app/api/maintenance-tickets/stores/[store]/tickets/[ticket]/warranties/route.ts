import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string }> }
) {
  const { store, ticket } = await params;
  if (!store || !ticket) return errorJson("MISSING_PARAM", "store and ticket are required", 400);

  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/warranties`;
  return proxyRawPost(request, upstreamUrl);
}
