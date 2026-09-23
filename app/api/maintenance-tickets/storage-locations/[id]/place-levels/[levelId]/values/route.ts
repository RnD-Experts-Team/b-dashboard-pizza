import { NextRequest } from "next/server";
import {
  BASE_URL,
  errorJson,
  proxyJsonPost,
} from "@/app/api/maintenance-tickets/_lib/proxy";

/**
 * Declare a value on a level — "C" on Shelf, "8" on Row.
 *
 * Values are declared rather than typed freehand, which is the only thing that
 * makes "what is on Shelf C?" answerable: "C", "c" and "Shelf C" cannot become
 * three different shelves. The picker calls this inline so declaring a new
 * shelf never means leaving the screen.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; levelId: string }> }
) {
  const { id, levelId } = await params;
  if (!id || !levelId) return errorJson("MISSING_PARAM", "id and levelId are required", 400);

  return proxyJsonPost(
    request,
    `${BASE_URL}/storage-locations/${encodeURIComponent(id)}/place-levels/${encodeURIComponent(levelId)}/values`
  );
}
