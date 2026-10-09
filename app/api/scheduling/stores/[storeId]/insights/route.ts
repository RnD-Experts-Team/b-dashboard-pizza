import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  fetchWithTimeout,
  errorResponse,
} from "@/app/api/_lib/auth";
import { OPERATIONS_API_URL } from "@/app/api/scheduling/_lib/proxy";
import {
  insightsWindow,
  mergeInsights,
  type RawSalesInsights,
  type RawStaffingInsights,
} from "@/lib/scheduling/insights";

export const dynamic = "force-dynamic";

/**
 * GET /api/scheduling/stores/{storeId}/insights?week_start=YYYY-MM-DD[&today=YYYY-MM-DD]
 *
 * The history a manager wants while building a week: what each hour of each
 * weekday usually sells, and how many people were actually on the clock for it.
 *
 * Two services own the two halves, so this route asks both at once and joins
 * them: sales from LC_PIZZA_DATA, people from OperationsPizza. The window (the
 * last four complete business weeks, see `insightsWindow`) is decided HERE and
 * sent to both as explicit dates, so the halves can never cover different days.
 *
 * Each half is optional. If one service is down the other still renders, and
 * `sources` says which one is missing. Only when BOTH fail is the request an
 * error.
 *
 * The user's own token goes to both: store access is checked upstream per
 * store, so a server-level token here would bypass it.
 */

const DATA_API_URL =
  process.env.DATA_API_URL ||
  process.env.NEXT_PUBLIC_DATA_API_URL ||
  "https://data.lcportal.cloud/api";

const TIMEOUT_MS = Number(process.env.OPERATIONS_TIMEOUT_MS) || 30_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STORE_RE = /^[A-Za-z0-9_-]{1,32}$/;

async function fetchJson<T>(
  url: string,
  authorization: string,
  signal: AbortSignal,
): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(
      url,
      { method: "GET", headers: { Accept: "application/json", Authorization: authorization } },
      TIMEOUT_MS,
      signal,
    );
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { storeId } = await params;
  if (!STORE_RE.test(storeId)) {
    return errorResponse("INVALID_REQUEST", "Invalid store.", 400);
  }

  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("week_start") ?? "";
  const today = searchParams.get("today") ?? new Date().toISOString().slice(0, 10);

  if (!DATE_RE.test(weekStart) || !DATE_RE.test(today)) {
    return errorResponse("INVALID_REQUEST", "week_start and today must be YYYY-MM-DD.", 400);
  }

  const window = insightsWindow(weekStart, today);
  const query = `start_date=${window.start}&end_date=${window.end}`;
  const authorization = getAuthorizationHeader(request)!;
  const id = encodeURIComponent(storeId);

  const [sales, staffing] = await Promise.all([
    fetchJson<RawSalesInsights>(
      `${DATA_API_URL}/reports/scheduling-insights/${id}?${query}`,
      authorization,
      request.signal,
    ),
    fetchJson<{ data: RawStaffingInsights }>(
      `${OPERATIONS_API_URL}/v1/stores/${id}/schedule/insights?${query}`,
      authorization,
      request.signal,
    ),
  ]);

  if (!sales && !staffing) {
    return errorResponse(
      "UPSTREAM_ERROR",
      "Could not load the staffing history. Try again in a moment.",
      502,
    );
  }

  return NextResponse.json(
    { data: mergeInsights(sales, staffing?.data ?? null, window) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
