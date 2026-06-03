import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyJsonPost } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string; partUsage: string }> }
) {
  const { store, ticket, partUsage } = await params;
  if (!store || !ticket || !partUsage) {
    return errorJson("MISSING_PARAM", "store, ticket, and partUsage are required", 400);
  }

  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/part-usages/${encodeURIComponent(partUsage)}/mistaken`;
  return proxyJsonPost(request, upstreamUrl);
}
