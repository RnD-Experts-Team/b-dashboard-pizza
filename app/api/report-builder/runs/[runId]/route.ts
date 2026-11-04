import { NextRequest } from "next/server";
import { UPSTREAM, invalidId, proxyReportBuilder } from "../../_lib/proxy";

type Ctx = { params: Promise<{ runId: string }> };

/** GET /api/report-builder/runs/{runId} — status, period, row count, files. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { runId } = await params;
  return invalidId(runId, "run id") ?? proxyReportBuilder(request, UPSTREAM.runItem(runId), { method: "GET", search: "" });
}
