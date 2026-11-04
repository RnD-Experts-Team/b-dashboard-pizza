import { NextRequest } from "next/server";
import { requireAuthorization } from "@/app/api/_lib/auth";
import { proxyBusinessReport } from "@/app/api/reports/_lib/business-proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const HIRING_BASE_URL =
  process.env.HIRING_API_URL ||
  process.env.NEXT_PUBLIC_HIRING_API_URL ||
  "https://hiring.lcportal.cloud/api";

/**
 * GET /api/reports/labor?stores[]=…&start_date=…&end_date=…
 * Proxy → GET {HIRING_API_URL}/v1/reports/labor?<same query>
 *
 * The Labor report for many stores over any range.
 */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  return proxyBusinessReport(
    request,
    `${HIRING_BASE_URL}/v1/reports/labor${request.nextUrl.search}`,
    "hiring service",
    { method: "GET" },
  );
}
