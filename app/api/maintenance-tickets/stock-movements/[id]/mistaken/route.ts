import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyJsonPost } from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * Flags the movement AND writes the reversing movement, returning both.
 *
 * Nothing is deleted and no balance changes by the flag alone — the
 * correction IS the reversal. proxyJsonPost parses the body, so the client
 * must post `{}`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return errorJson("MISSING_PARAM", "id is required", 400);
  return proxyJsonPost(request, `${BASE_URL}/stock-movements/${encodeURIComponent(id)}/mistaken`);
}
