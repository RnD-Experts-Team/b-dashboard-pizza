import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyDelete, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ id: string }> };

/**
 * Update. Soft-deleted rather than removed, so a retired location keeps its
 * history and its balances stay readable.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!id) return errorJson("MISSING_PARAM", "id is required", 400);
  return proxyRawPost(request, `${BASE_URL}/storage-locations/${encodeURIComponent(id)}`);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!id) return errorJson("MISSING_PARAM", "id is required", 400);
  return proxyDelete(request, `${BASE_URL}/storage-locations/${encodeURIComponent(id)}`);
}
