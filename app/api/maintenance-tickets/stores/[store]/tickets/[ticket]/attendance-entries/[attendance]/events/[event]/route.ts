import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyJsonPatch } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * Correct when one event happened.
 *
 * Refused upstream with a 422 once a pay sheet has claimed the session — you
 * can fix what nobody has been paid against, but not quietly rewrite what
 * somebody was paid on. The message explains the alternative, so let it through
 * rather than replacing it.
 */
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ store: string; ticket: string; attendance: string; event: string }> }
) {
  const { store, ticket, attendance, event } = await params;
  if (!store || !ticket || !attendance || !event) {
    return errorJson("MISSING_PARAM", "store, ticket, attendance, and event are required", 400);
  }

  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/attendance-entries/${encodeURIComponent(attendance)}/events/${encodeURIComponent(event)}`;
  return proxyJsonPatch(request, upstreamUrl);
}
