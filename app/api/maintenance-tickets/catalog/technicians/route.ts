import { NextRequest } from "next/server";
import { BASE_URL, proxyGet, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * Technicians: ?search=&category_id=&emergency=1&store=&issue_id=&urgent=1&with_trashed=1 (ranked when store/issue_id is given).
 * The query string is forwarded verbatim (search, filters, with_trashed…).
 */
export async function GET(request: NextRequest) {
  const qs = new URL(request.url).search;
  return proxyGet(request, `${BASE_URL}/technicians${qs}`);
}

export async function POST(request: NextRequest) {
  return proxyRawPost(request, `${BASE_URL}/technicians`);
}
