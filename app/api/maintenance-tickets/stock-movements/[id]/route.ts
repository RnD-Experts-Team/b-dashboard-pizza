import { NextRequest } from "next/server";
import { BASE_URL, errorJson, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return errorJson("MISSING_PARAM", "id is required", 400);
  return proxyGet(request, `${BASE_URL}/stock-movements/${encodeURIComponent(id)}`);
}
