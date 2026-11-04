import { NextRequest } from "next/server";
import { UPSTREAM, proxyReportBuilder } from "../_lib/proxy";

/** GET /api/report-builder/templates → the caller's own templates plus org-wide ones. */
export async function GET(request: NextRequest) {
  return proxyReportBuilder(request, UPSTREAM.templates(), { method: "GET" });
}

/** POST /api/report-builder/templates `{name, description, definition, visibility}`. */
export async function POST(request: NextRequest) {
  return proxyReportBuilder(request, UPSTREAM.templates(), { method: "POST", body: true, search: "" });
}
