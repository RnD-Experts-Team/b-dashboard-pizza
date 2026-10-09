import { NextRequest } from "next/server";
import { BASE_URL, proxyJsonPatch } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ id: string }> };

/** A technician's overall rating, and the overall "call first" pin. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyJsonPatch(request, `${BASE_URL}/technicians/${encodeURIComponent(id)}/rating`);
}
