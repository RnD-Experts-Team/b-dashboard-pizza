import { NextRequest } from "next/server";
import { BASE_URL, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";
import { technicianAnalyticsQuery } from "@/app/api/maintenance-tickets/technician-analytics/_forward";

type Params = { params: Promise<{ id: string }> };

/** GET /technicians/{id}/analytics -- one technician's pay and work in a range. */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyGet(request, `${BASE_URL}/technicians/${encodeURIComponent(id)}/analytics?${technicianAnalyticsQuery(request.url)}`);
}
