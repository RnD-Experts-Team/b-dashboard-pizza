import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";

/** Every note on the ticket, locked (MOS only) ones included. The auth rules decide who may. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string }> }
) {
  const { store, ticket } = await params;
  if (!store || !ticket) return errorJson("MISSING_PARAM", "store and ticket are required", 400);
  return proxyGet(request, `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/notes/all`);
}
