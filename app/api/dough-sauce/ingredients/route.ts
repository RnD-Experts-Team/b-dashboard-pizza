import { NextRequest } from "next/server";
import { forward } from "../_lib/route-utils";

export const dynamic = "force-dynamic";

/** GET /api/dough-sauce/ingredients → [data] /dough-sauce/ingredients */
export async function GET(request: NextRequest) {
  return forward("data", request, "/dough-sauce/ingredients", "GET");
}
