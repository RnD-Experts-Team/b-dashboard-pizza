import { NextRequest } from "next/server";
import { UPSTREAM, proxyReportBuilder } from "../_lib/proxy";

/** GET /api/report-builder/runs[?template_id=] → the caller's runs, newest first. */
export async function GET(request: NextRequest) {
  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  const templateId = incoming.get("template_id");
  if (templateId) query.set("template_id", templateId);
  const search = query.toString();
  return proxyReportBuilder(request, UPSTREAM.runs(), { method: "GET", search: search ? `?${search}` : "" });
}
