import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyDelete } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; ticket: string }> }
) {
  const { store, ticket } = await params;
  if (!store || !ticket) return errorJson("MISSING_PARAM", "store and ticket are required", 400);

  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}`;
  return proxyDelete(request, upstreamUrl);
}
