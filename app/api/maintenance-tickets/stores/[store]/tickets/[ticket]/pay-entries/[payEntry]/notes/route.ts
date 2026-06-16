import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string; payEntry: string }> }
) {
  const { store, ticket, payEntry } = await params;
  if (!store || !ticket || !payEntry) return errorJson("MISSING_PARAM", "store, ticket and payEntry are required", 400);
  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/pay-entries/${encodeURIComponent(payEntry)}/notes`;
  return proxyRawPost(request, upstreamUrl);
}
