import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyJsonPatch } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * Correct when one event happened, on a visit that names no ticket.
 *
 * Refused upstream with a 422 once a pay sheet has claimed the session — you
 * can fix what nobody has been paid against, but not quietly rewrite what
 * somebody was paid on.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ attendance: string; event: string }> }
) {
  const { attendance, event } = await params;
  if (!attendance || !event) {
    return errorJson("MISSING_PARAM", "attendance and event are required", 400);
  }

  return proxyJsonPatch(
    request,
    `${BASE_URL}/attendance-entries/${encodeURIComponent(attendance)}/events/${encodeURIComponent(event)}`
  );
}
