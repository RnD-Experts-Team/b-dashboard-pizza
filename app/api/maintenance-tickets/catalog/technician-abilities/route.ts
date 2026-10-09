import { NextRequest } from "next/server";
import { BASE_URL, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * Every technician rating, overall and per issue. Its own read upstream, never
 * part of the technician list -- store users read that list.
 */
export async function GET(request: NextRequest) {
  const issueId = request.nextUrl.searchParams.get("issue_id");
  const query = issueId && /^\d+$/.test(issueId) ? `?issue_id=${issueId}` : "";
  return proxyGet(request, `${BASE_URL}/technician-abilities${query}`);
}
