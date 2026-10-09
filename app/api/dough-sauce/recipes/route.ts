import { NextRequest } from "next/server";
import { forward } from "../_lib/route-utils";

export const dynamic = "force-dynamic";

/** GET /api/dough-sauce/recipes → [data] /dough-sauce/recipes */
export async function GET(request: NextRequest) {
  return forward("data", request, "/dough-sauce/recipes", "GET");
}

/** POST /api/dough-sauce/recipes → [data] /dough-sauce/recipes */
export async function POST(request: NextRequest) {
  return forward("data", request, "/dough-sauce/recipes", "POST");
}
