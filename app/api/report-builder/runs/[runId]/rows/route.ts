import { NextRequest } from "next/server";
import { errorResponse } from "@/app/api/_lib/auth";
import { MAX_PER_PAGE, MIN_PER_PAGE } from "@/lib/report-builder/url-state";
import { UPSTREAM, invalidId, proxyReportBuilder } from "../../../_lib/proxy";

type Ctx = { params: Promise<{ runId: string }> };

const HTTP_BAD_REQUEST = 400;

/** GET /api/report-builder/runs/{runId}/rows?page=&per= — one page of the run's CSV (25–200 rows). */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { runId } = await params;
  const bad = invalidId(runId, "run id");
  if (bad) return bad;

  const incoming = new URL(request.url).searchParams;
  const page = Number(incoming.get("page") ?? "1");
  const per = Number(incoming.get("per") ?? String(MIN_PER_PAGE));
  if (!Number.isInteger(page) || page < 1)
    return errorResponse("INVALID_REQUEST", "page must be a positive integer.", HTTP_BAD_REQUEST, { param: "page" });
  if (!Number.isInteger(per) || per < MIN_PER_PAGE || per > MAX_PER_PAGE)
    return errorResponse("INVALID_REQUEST", `per must be between ${MIN_PER_PAGE} and ${MAX_PER_PAGE}.`, HTTP_BAD_REQUEST, { param: "per" });

  const query = new URLSearchParams({ page: String(page), per: String(per) });
  return proxyReportBuilder(request, UPSTREAM.runRows(runId), { method: "GET", search: `?${query.toString()}` });
}
