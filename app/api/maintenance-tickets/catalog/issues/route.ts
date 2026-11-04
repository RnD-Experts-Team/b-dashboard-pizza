import { NextRequest } from "next/server";
import { BASE_URL, proxyGet, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * Catalog issues (what can break).
 * The query string is forwarded verbatim (search, filters, with_trashed…).
 */
export async function GET(request: NextRequest) {
  const qs = new URL(request.url).search;
  return proxyGet(request, `${BASE_URL}/issues${qs}`);
}

export async function POST(request: NextRequest) {
  return proxyRawPost(request, `${BASE_URL}/issues`);
}
