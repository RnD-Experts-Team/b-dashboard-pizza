import { NextRequest } from "next/server";
import { BASE_URL, proxyGet, proxyRawPost } from "@/app/api/daily-pay-entries/_lib/proxy";

/** Paginated list of daily pay entries. Forwards the full query string. */
export async function GET(request: NextRequest) {
  const qs = new URL(request.url).searchParams.toString();
  return proxyGet(request, `${BASE_URL}/daily-pay-entries${qs ? `?${qs}` : ""}`);
}

/**
 * Create an entry. Raw passthrough: the body is multipart with bracket keys
 * (payments[i][lines][j][files][]) and the boundary must survive untouched.
 */
export async function POST(request: NextRequest) {
  return proxyRawPost(request, `${BASE_URL}/daily-pay-entries`);
}
