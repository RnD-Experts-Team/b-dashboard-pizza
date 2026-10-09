import { NextRequest } from "next/server";
import { BASE_URL, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ store: string; issue: string }> };

/** Only these reach upstream; anything else on the query string is dropped. */
const FORWARDED = ["page", "per_page", "exclude_ticket", "open_only"] as const;

/**
 * GET /stores/{store}/issues/{issue}/history -- earlier tickets at this store
 * for the same catalog issue ("the last Oven tickets for this store").
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { store, issue } = await params;
  const incoming = new URL(request.url).searchParams;
  const forward = new URLSearchParams();
  for (const key of FORWARDED) {
    const value = incoming.get(key);
    if (value !== null && value !== "") forward.set(key, value);
  }
  const qs = forward.toString();

  return proxyGet(
    request,
    `${BASE_URL}/stores/${encodeURIComponent(store)}/issues/${encodeURIComponent(issue)}/history${qs ? `?${qs}` : ""}`,
  );
}
