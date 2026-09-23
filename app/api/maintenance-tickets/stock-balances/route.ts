import { NextRequest } from "next/server";
import { BASE_URL, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * On hand per part per location, computed upstream over the WHOLE ledger.
 *
 * Never derive this by summing a page of movements — the ledger is unfiltered
 * and paginated, so a page sum is meaningless. Balances can also be NEGATIVE,
 * as the trace of a reversal applied after the stock was consumed; the UI
 * renders that rather than clamping it.
 */
export async function GET(request: NextRequest) {
  const qs = new URL(request.url).searchParams.toString();
  return proxyGet(request, `${BASE_URL}/stock-balances${qs ? `?${qs}` : ""}`);
}
