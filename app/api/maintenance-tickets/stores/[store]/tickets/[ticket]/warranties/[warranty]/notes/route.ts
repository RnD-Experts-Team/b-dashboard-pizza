import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string; warranty: string }> }
) {
  const { store, ticket, warranty } = await params;
  if (!store || !ticket || !warranty) return errorJson("MISSING_PARAM", "store, ticket and warranty are required", 400);
  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/warranties/${encodeURIComponent(warranty)}/notes`;
  return proxyRawPost(request, upstreamUrl);
}
