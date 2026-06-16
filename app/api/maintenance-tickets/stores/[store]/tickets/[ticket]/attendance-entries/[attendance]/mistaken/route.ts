import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyJsonPost } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string; attendance: string }> }
) {
  const { store, ticket, attendance } = await params;
  if (!store || !ticket || !attendance) {
    return errorJson("MISSING_PARAM", "store, ticket, and attendance are required", 400);
  }

  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/attendance-entries/${encodeURIComponent(attendance)}/mistaken`;
  return proxyJsonPost(request, upstreamUrl);
}
