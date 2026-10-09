import { NextRequest } from "next/server";
import { proxyInventory } from "../_lib/proxy";

/**
 * GET /api/inventory/counts?date_from=&date_to=&ultimatrix_ids=&include_missing=
 * Counted quantities for EVERY active store in one call (Dough & Sauce weekly
 * grid). There is no store parameter: the backend returns all stores and
 * pizzasys decides whether the caller may see them all — a specialist gets
 * 200, a store manager gets 403 and uses the per-store route instead.
 * The 403 is mirrored verbatim so the client can fall back.
 */
export async function GET(request: NextRequest) {
  return proxyInventory(request, "/inventory/counts", { method: "GET" });
}
