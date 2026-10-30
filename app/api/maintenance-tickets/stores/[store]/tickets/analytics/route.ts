import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ store: string }> };

/** Aggregates for a store's tickets, scoped by the same filters as the list. */
export async function GET(request: NextRequest, { params }: Params) {
  const { store } = await params;
  if (!store) return errorJson("MISSING_PARAM", "store is required", 400);
  const qs = new URL(request.url).search;
  return proxyGet(request, `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/analytics${qs}`);
}
