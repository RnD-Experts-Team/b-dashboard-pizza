import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string; issue: string }> }
) {
  const { store, ticket, issue } = await params;
  if (!store || !ticket || !issue) return errorJson("MISSING_PARAM", "store, ticket and issue are required", 400);
  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/issues/${encodeURIComponent(issue)}/attachments`;
  return proxyRawPost(request, upstreamUrl);
}
