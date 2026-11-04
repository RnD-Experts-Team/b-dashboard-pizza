import { NextRequest } from "next/server";
import { errorResponse } from "@/app/api/_lib/auth";
import { DOWNLOAD_TIMEOUT_MS, UPSTREAM, invalidId, proxyReportBuilder } from "../../../_lib/proxy";

type Ctx = { params: Promise<{ runId: string }> };

const HTTP_BAD_REQUEST = 400;
const FORMATS: ReadonlySet<string> = new Set(["csv", "xlsx"]);

/** GET /api/report-builder/runs/{runId}/download?format=csv|xlsx — the file, streamed through. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { runId } = await params;
  const bad = invalidId(runId, "run id");
  if (bad) return bad;

  const format = new URL(request.url).searchParams.get("format") ?? "csv";
  if (!FORMATS.has(format))
    return errorResponse("INVALID_REQUEST", "format must be csv or xlsx.", HTTP_BAD_REQUEST, { param: "format" });

  return proxyReportBuilder(request, UPSTREAM.runDownload(runId), {
    method: "GET",
    search: `?format=${format}`,
    timeoutMs: DOWNLOAD_TIMEOUT_MS,
    stream: true,
  });
}
