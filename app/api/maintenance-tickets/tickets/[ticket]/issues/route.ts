import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * A ticket's issues, read without a store segment.
 *
 * Not a convenience route. A ticket created through POST /tickets carries
 * other_store and a null store_id, so it can never bind inside upstream's
 * /stores/{store}/... group -- those tickets were creatable but unreadable.
 * The store-scoped twin remains the canonical route when a store is known.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticket: string }> }
) {
  const { ticket } = await params;
  if (!ticket) return errorJson("MISSING_PARAM", "ticket is required", 400);

  // Forwarded for ?store_id: upstream ignores it, but pizzasys reads it to
  // scope the rule to the ticket's store. Without it a reports-view user, whose
  // permission is granted per store rather than globally, is denied here.
  const qs = new URL(request.url).searchParams.toString();

  return proxyGet(
    request,
    `${BASE_URL}/tickets/${encodeURIComponent(ticket)}/issues${qs ? `?${qs}` : ""}`
  );
}
