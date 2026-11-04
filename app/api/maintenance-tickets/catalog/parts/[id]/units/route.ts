import { NextRequest } from "next/server";
import { BASE_URL, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ id: string }> };

/** GET parts/{part}/units?status= -- the serial-numbered units of one part. MAINTENANCE §1. */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const qs = new URL(request.url).search;
  return proxyGet(request, `${BASE_URL}/parts/${encodeURIComponent(id)}/units${qs}`);
}
