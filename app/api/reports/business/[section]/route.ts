import { NextRequest } from "next/server";
import { requireAuthorization, errorResponse } from "@/app/api/_lib/auth";
import { proxyBusinessReport } from "@/app/api/reports/_lib/business-proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const DATA_BASE_URL =
  process.env.DATA_API_URL ||
  process.env.NEXT_PUBLIC_DATA_API_URL ||
  "https://data.lcportal.cloud/api";

const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;

/** The Data service's Business Reports sections (one route + one auth rule each). */
const SECTIONS = new Set([
  "sales",
  "operations",
  "menu",
  "orders",
  "quality",
  "debriefs",
  "store-score",
  "sales-history",
]);

/**
 * POST /api/reports/business/{section}
 * Proxy → POST {DATA_API_URL}/reports/business/{section}
 *
 * Body `{ start_date, end_date, stores: string[] }` goes upstream as-is.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ section: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { section } = await params;
  if (!SECTIONS.has(section)) {
    return errorResponse("NOT_FOUND", `Unknown report section: ${section}`, HTTP_NOT_FOUND);
  }

  let body: string;
  try {
    body = JSON.stringify(await request.json());
  } catch {
    return errorResponse("INVALID_REQUEST", "Request body must be JSON", HTTP_BAD_REQUEST);
  }

  return proxyBusinessReport(
    request,
    `${DATA_BASE_URL}/reports/business/${section}`,
    "data service",
    { method: "POST", body },
  );
}
