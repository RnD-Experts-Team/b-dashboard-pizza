import { NextRequest } from "next/server";
import { BASE_URL, proxyGet, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * The append-only stock ledger. GLOBAL — no [store] segment.
 *
 * The query string is forwarded VERBATIM, which is what keeps the repeated
 * `types[]`, `part_ids[]`, `storage_location_ids[]` keys intact.
 */
export async function GET(request: NextRequest) {
  const qs = new URL(request.url).searchParams.toString();
  return proxyGet(request, `${BASE_URL}/stock-movements${qs ? `?${qs}` : ""}`);
}

/**
 * One movement is one BATCH: several parts, their amounts, where they are.
 * Raw passthrough preserves the multipart boundary for `lines[N][…]` and any
 * attachments.
 */
export async function POST(request: NextRequest) {
  return proxyRawPost(request, `${BASE_URL}/stock-movements`);
}
