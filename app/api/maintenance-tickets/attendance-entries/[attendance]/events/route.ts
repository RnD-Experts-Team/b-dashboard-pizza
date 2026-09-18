import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyJsonPost } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * Record one thing that happened, WITHOUT naming a ticket.
 *
 * Note the absence of a [store] and [ticket] segment, same as the create
 * endpoint one level up. A visit covering issues on several tickets has no one
 * ticket its URL could honestly name, and it needs the same freedom to keep
 * adding to the session it just opened.
 *
 * The ticket-nested equivalent stays for the ordinary single-ticket case.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attendance: string }> }
) {
  const { attendance } = await params;
  if (!attendance) return errorJson("MISSING_PARAM", "attendance is required", 400);

  return proxyJsonPost(
    request,
    `${BASE_URL}/attendance-entries/${encodeURIComponent(attendance)}/events`
  );
}
