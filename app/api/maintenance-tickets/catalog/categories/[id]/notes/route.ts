import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return errorJson("MISSING_PARAM", "id is required", 400);
  const upstreamUrl = `${BASE_URL}/categories/${encodeURIComponent(id)}/notes`;
  return proxyRawPost(request, upstreamUrl);
}
