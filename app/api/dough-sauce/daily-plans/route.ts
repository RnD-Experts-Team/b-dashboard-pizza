import { NextRequest } from "next/server";
import { forward } from "../_lib/route-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/dough-sauce/daily-plans?store_ids=a,b&dates=x,y → [data] /dough-sauce/daily-plans
 *
 * Every store × every date in ONE call (answer: `stores[store][date]`, each entry shaped like `daily-plan`).
 * The query string (`store_ids`, `dates`, `include_refunded`, `lookback`) passes through. The upstream
 * refuses the whole call (403) when any listed store isn't one the user may see.
 */
export async function GET(request: NextRequest) {
  return forward("data", request, "/dough-sauce/daily-plans", "GET");
}
