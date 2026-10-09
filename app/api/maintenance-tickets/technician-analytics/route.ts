import { NextRequest } from "next/server";
import { BASE_URL, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";
import { technicianAnalyticsQuery } from "./_forward";

/** GET /technician-analytics -- every technician's pay and work in a range. */
export async function GET(request: NextRequest) {
  return proxyGet(request, `${BASE_URL}/technician-analytics?${technicianAnalyticsQuery(request.url)}`);
}
