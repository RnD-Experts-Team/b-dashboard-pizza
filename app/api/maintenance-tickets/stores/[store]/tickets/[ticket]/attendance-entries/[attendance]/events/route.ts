import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyJsonPost } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * Record one thing that happened on the clock.
 *
 * Attendance is an append-only event ledger: clocked in, set off, arrived,
 * went on break, came back, clocked out — each its own row. Adding to a saved
 * session is an insert, where before it meant flagging the whole record wrong
 * and typing it again, because the API had no update path at all.
 *
 * Upstream returns the WHOLE session, and it may not be the one in this URL: a
 * clock_in on an already-open session opens a new one, because coming back to a
 * store later is a second visit. Use the id that comes back.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string; attendance: string }> }
) {
  const { store, ticket, attendance } = await params;
  if (!store || !ticket || !attendance) {
    return errorJson("MISSING_PARAM", "store, ticket, and attendance are required", 400);
  }

  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/attendance-entries/${encodeURIComponent(attendance)}/events`;
  return proxyJsonPost(request, upstreamUrl);
}
