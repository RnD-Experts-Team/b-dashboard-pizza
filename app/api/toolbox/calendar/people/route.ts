import { NextRequest } from "next/server";
import { proxyToolbox } from "@/app/api/toolbox/_lib/proxy";

export const dynamic = "force-dynamic";

/**
 * The store managers a "Chosen people" event or task can be given to
 * (FRONTEND_CALENDAR_CHANGES.md, 2026-11-18): `?q=` searches by name; up to 100,
 * sorted by name, each with their stores (or "all"). The query is forwarded as-is.
 */
export async function GET(request: NextRequest) {
  return proxyToolbox(request, "/calendar/people", { method: "GET" });
}
