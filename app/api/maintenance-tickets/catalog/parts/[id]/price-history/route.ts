import { NextRequest } from "next/server";
import { BASE_URL, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ id: string }> };

/** GET parts/{part}/price-history -- what we have paid for this part, and when (newest 50). */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyGet(request, `${BASE_URL}/parts/${encodeURIComponent(id)}/price-history`);
}
