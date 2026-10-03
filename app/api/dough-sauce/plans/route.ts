import { NextRequest } from "next/server";
import { forward } from "../_lib/route-utils";

export const dynamic = "force-dynamic";

/** GET /api/dough-sauce/plans → [audit] /dough-sauce/plans */
export async function GET(request: NextRequest) {
  return forward("audit", request, "/dough-sauce/plans", "GET");
}
