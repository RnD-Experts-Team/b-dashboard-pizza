import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ section: string }> };

const SECTIONS = new Set(["summary", "activity", "watchlist", "finances", "coverage"]);

/** Only these reach upstream. */
const SINGLE = [
  "from",
  "to",
  "recurring_min",
  "recurring_days",
  "untouched_days",
  "page",
  "per_page",
  // finances / coverage (MAINTENANCE §6)
  "category_id",
  "technician_id",
  "supplier_id",
  "group",
] as const;
/** Repeatable keys. */
const MANY = ["stores[]", "issue_ids[]"] as const;

/**
 * GET /maintenance-analytics/{summary|activity|watchlist|finances|coverage}
 * -- the analytics page's sections, for the stores named in stores[].
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { section } = await params;
  if (!SECTIONS.has(section)) {
    return errorJson("NOT_FOUND", "Unknown analytics section", 404);
  }

  const incoming = new URL(request.url).searchParams;
  const forward = new URLSearchParams();
  for (const key of MANY) {
    for (const value of incoming.getAll(key)) {
      if (value) forward.append(key, value);
    }
  }
  for (const key of SINGLE) {
    const value = incoming.get(key);
    if (value !== null && value !== "") forward.set(key, value);
  }

  return proxyGet(request, `${BASE_URL}/maintenance-analytics/${section}?${forward.toString()}`);
}
