import { NextRequest } from "next/server";
import { BASE_URL, proxyJsonPatch } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ store: string; ticket: string; note: string }> };

/** PATCH {is_private} -- lock (MOS only) or unlock a note on this ticket. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { store, ticket, note } = await params;

  return proxyJsonPatch(
    request,
    `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets/${encodeURIComponent(ticket)}/notes/${encodeURIComponent(note)}/privacy`,
  );
}
