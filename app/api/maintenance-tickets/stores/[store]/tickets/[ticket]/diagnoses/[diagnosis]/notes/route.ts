import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string; diagnosis: string }> }
) {
  const { store, ticket, diagnosis } = await params;
  if (!store || !ticket || !diagnosis) return errorJson("MISSING_PARAM", "store, ticket and diagnosis are required", 400);
  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/diagnoses/${encodeURIComponent(diagnosis)}/notes`;
  return proxyRawPost(request, upstreamUrl);
}
