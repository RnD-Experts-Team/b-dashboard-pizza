import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string; assignment: string }> }
) {
  const { store, ticket, assignment } = await params;
  if (!store || !ticket || !assignment) return errorJson("MISSING_PARAM", "store, ticket and assignment are required", 400);
  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/assignments/${encodeURIComponent(assignment)}/notes`;
  return proxyRawPost(request, upstreamUrl);
}
