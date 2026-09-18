import { NextRequest } from "next/server";
import {
  BASE_URL,
  errorJson,
  proxyJsonPut,
} from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * Say where this part sits inside its location.
 *
 * PUT, not PATCH, because it replaces the WHOLE address: a level left out of
 * `place_value_ids` is cleared, and an empty array clears the lot — which is
 * the honest way to say "we no longer know", and a different thing from never
 * having said. A part has one address per location, so a partial update has
 * nothing to mean.
 *
 * This is the write path the slot feature never had. Shelves could be named and
 * displayed; nothing could ever put a part on one.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ balanceId: string }> }
) {
  const { balanceId } = await params;
  if (!balanceId) return errorJson("MISSING_PARAM", "balanceId is required", 400);

  return proxyJsonPut(
    request,
    `${BASE_URL}/stock-balances/${encodeURIComponent(balanceId)}/place`
  );
}
