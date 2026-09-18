import { NextRequest } from "next/server";
import {
  BASE_URL,
  errorJson,
  proxyDelete,
  proxyJsonPatch,
} from "@/app/api/maintenance-tickets/_lib/proxy";

/** One named place inside a location. Renaming and retiring. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  const { id, slotId } = await params;
  if (!id || !slotId) return errorJson("MISSING_PARAM", "id and slotId are required", 400);

  return proxyJsonPatch(
    request,
    `${BASE_URL}/storage-locations/${encodeURIComponent(id)}/slots/${encodeURIComponent(slotId)}`
  );
}

/**
 * Retires it. Upstream soft-deletes and the foreign key nulls rather than
 * restricting, so stock recorded there is left exactly where it is -- we simply
 * stop claiming to know which shelf.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  const { id, slotId } = await params;
  if (!id || !slotId) return errorJson("MISSING_PARAM", "id and slotId are required", 400);

  return proxyDelete(
    request,
    `${BASE_URL}/storage-locations/${encodeURIComponent(id)}/slots/${encodeURIComponent(slotId)}`
  );
}
