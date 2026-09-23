import { NextRequest } from "next/server";
import { BASE_URL, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * Attendance entries logged WITHOUT going through a ticket's nested URL — note
 * the absence of a [store] segment, same as storage-locations/.
 *
 * The payload still names ticket_issue_ids; this endpoint just does not make
 * the caller pick one ticket to hang the request off. That is the fix for
 * "drove to one store, worked three tickets".
 *
 * proxyRawPost forwards the raw body and the inbound content-type verbatim, so
 * it covers both the JSON and the multipart branch with no special-casing.
 */
export async function POST(request: NextRequest) {
  return proxyRawPost(request, `${BASE_URL}/attendance-entries`);
}
