import { NextRequest } from "next/server";
import {
  BASE_URL,
  errorJson,
  proxyDelete,
  proxyJsonPatch,
} from "@/app/api/maintenance-tickets/_lib/proxy";

/** Rename or reorder one declared value. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; levelId: string; valueId: string }> }
) {
  const { id, levelId, valueId } = await params;
  if (!id || !levelId || !valueId) {
    return errorJson("MISSING_PARAM", "id, levelId and valueId are required", 400);
  }

  return proxyJsonPatch(
    request,
    `${BASE_URL}/storage-locations/${encodeURIComponent(id)}/place-levels/${encodeURIComponent(levelId)}/values/${encodeURIComponent(valueId)}`
  );
}

/**
 * Retire one declared value.
 *
 * Upstream drops the addresses that used it in the same transaction, so a part
 * that was on this shelf keeps its other levels and its quantity, and simply
 * stops claiming a place that no longer exists.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; levelId: string; valueId: string }> }
) {
  const { id, levelId, valueId } = await params;
  if (!id || !levelId || !valueId) {
    return errorJson("MISSING_PARAM", "id, levelId and valueId are required", 400);
  }

  return proxyDelete(
    request,
    `${BASE_URL}/storage-locations/${encodeURIComponent(id)}/place-levels/${encodeURIComponent(levelId)}/values/${encodeURIComponent(valueId)}`
  );
}
