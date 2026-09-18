import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyJsonPost } from "@/app/api/maintenance-tickets/_lib/proxy";

/** Strike one event on a visit that names no ticket. It stays in the ledger,
 *  struck through, and stops counting. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attendance: string; event: string }> }
) {
  const { attendance, event } = await params;
  if (!attendance || !event) {
    return errorJson("MISSING_PARAM", "attendance and event are required", 400);
  }

  return proxyJsonPost(
    request,
    `${BASE_URL}/attendance-entries/${encodeURIComponent(attendance)}/events/${encodeURIComponent(event)}/mistaken`
  );
}
