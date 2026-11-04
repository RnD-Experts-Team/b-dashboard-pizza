import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ store: string; ticket: string }> };

/** A ticket's issues, each with its workflow, costs and timeline (MAINTENANCE §2 "Read"). */
export async function GET(request: NextRequest, { params }: Params) {
  const { store, ticket } = await params;
  if (!store || !ticket) return errorJson("MISSING_PARAM", "store and ticket are required", 400);
  return proxyGet(
    request,
    `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/issues`,
  );
}
