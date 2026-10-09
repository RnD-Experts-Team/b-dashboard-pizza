import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyGet, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

/** The ticket's normal notes (locked ones left out). See ./all for the rest. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string }> }
) {
  const { store, ticket } = await params;
  if (!store || !ticket) return errorJson("MISSING_PARAM", "store and ticket are required", 400);
  return proxyGet(request, `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/notes`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string }> }
) {
  const { store, ticket } = await params;
  if (!store || !ticket) return errorJson("MISSING_PARAM", "store and ticket are required", 400);
  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/notes`;
  return proxyRawPost(request, upstreamUrl);
}
