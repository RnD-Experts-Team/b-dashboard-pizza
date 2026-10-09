import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ section: string }> };

const SECTIONS = new Set(["summary", "activity", "watchlist"]);

/** Only these reach upstream; `stores[]` may repeat. */
const SINGLE = ["from", "to", "recurring_min", "recurring_days", "untouched_days", "page", "per_page"] as const;

/**
 * GET /maintenance-analytics/{summary|activity|watchlist} -- the analytics
 * page's three sections, for the stores named in stores[].
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { section } = await params;
  if (!SECTIONS.has(section)) {
    return errorJson("NOT_FOUND", "Unknown analytics section", 404);
  }

  const incoming = new URL(request.url).searchParams;
  const forward = new URLSearchParams();
  for (const store of incoming.getAll("stores[]")) {
    if (store) forward.append("stores[]", store);
  }
  for (const key of SINGLE) {
    const value = incoming.get(key);
    if (value !== null && value !== "") forward.set(key, value);
  }

  return proxyGet(request, `${BASE_URL}/maintenance-analytics/${section}?${forward.toString()}`);
}
