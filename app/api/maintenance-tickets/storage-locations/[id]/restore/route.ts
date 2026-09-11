import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyJsonPost } from "@/app/api/maintenance-tickets/_lib/proxy";

/** proxyJsonPost parses the body, so the client must post `{}`, not nothing. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return errorJson("MISSING_PARAM", "id is required", 400);
  return proxyJsonPost(request, `${BASE_URL}/storage-locations/${encodeURIComponent(id)}/restore`);
}
