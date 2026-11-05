import { NextRequest } from "next/server";
import { UPSTREAM, proxyReportBuilder } from "../_lib/proxy";

/** POST /api/report-builder/run `{template_id, format}` → queues a run; answers the run (status "queued"). */
export async function POST(request: NextRequest) {
  return proxyReportBuilder(request, UPSTREAM.run(), { method: "POST", body: true, search: "" });
}
