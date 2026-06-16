import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyJsonPost } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string; assignment: string; delay: string }> }
) {
  const { store, ticket, assignment, delay } = await params;
  if (!store || !ticket || !assignment || !delay) {
    return errorJson("MISSING_PARAM", "store, ticket, assignment, and delay are required", 400);
  }

  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/assignments/${encodeURIComponent(assignment)}/delays/${encodeURIComponent(delay)}/mistaken`;
  return proxyJsonPost(request, upstreamUrl);
}
