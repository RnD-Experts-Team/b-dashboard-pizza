import { NextRequest } from "next/server";
import { UPSTREAM, proxyReportBuilder } from "../_lib/proxy";

/** GET /api/report-builder/catalog → Data GET /report-builder/catalog (every service's datasets, merged). */
export async function GET(request: NextRequest) {
  return proxyReportBuilder(request, UPSTREAM.catalog(), { method: "GET", search: "" });
}
