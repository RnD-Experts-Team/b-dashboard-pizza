import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyJsonPost } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * Strike one event.
 *
 * It stays in the ledger, struck through, and stops counting — the same flag
 * every other record here uses. Striking a clock-in leaves the session with no
 * opening, so its clock window goes null and its work time reports zero: there
 * is no window left to clip anything into.
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ store: string; ticket: string; attendance: string; event: string }> }
) {
  const { store, ticket, attendance, event } = await params;
  if (!store || !ticket || !attendance || !event) {
    return errorJson("MISSING_PARAM", "store, ticket, attendance, and event are required", 400);
  }

  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/attendance-entries/${encodeURIComponent(attendance)}/events/${encodeURIComponent(event)}/mistaken`;
  return proxyJsonPost(request, upstreamUrl);
}
