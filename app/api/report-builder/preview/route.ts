import { NextRequest } from "next/server";
import { UPSTREAM, proxyReportBuilder } from "../_lib/proxy";

/** POST /api/report-builder/preview `{definition}` → Data POST /report-builder/preview (first 200 rows, sync). */
export async function POST(request: NextRequest) {
  return proxyReportBuilder(request, UPSTREAM.preview(), { method: "POST", body: true, search: "" });
}
