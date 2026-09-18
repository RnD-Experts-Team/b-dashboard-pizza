import { NextRequest } from "next/server";
import {
  BASE_URL,
  errorJson,
  proxyDelete,
  proxyJsonPatch,
} from "@/app/api/maintenance-tickets/_lib/proxy";

/** Rename or reorder one level. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; levelId: string }> }
) {
  const { id, levelId } = await params;
  if (!id || !levelId) return errorJson("MISSING_PARAM", "id and levelId are required", 400);

  return proxyJsonPatch(
    request,
    `${BASE_URL}/storage-locations/${encodeURIComponent(id)}/place-levels/${encodeURIComponent(levelId)}`
  );
}

/**
 * Retire a level.
 *
 * Upstream soft-deletes the level and its values AND drops the addresses that
 * used them, in one transaction — so nothing is left pointing at something that
 * will never be shown again. Parts keep their other levels and their quantities
 * are never touched.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; levelId: string }> }
) {
  const { id, levelId } = await params;
  if (!id || !levelId) return errorJson("MISSING_PARAM", "id and levelId are required", 400);

  return proxyDelete(
    request,
    `${BASE_URL}/storage-locations/${encodeURIComponent(id)}/place-levels/${encodeURIComponent(levelId)}`
  );
}
