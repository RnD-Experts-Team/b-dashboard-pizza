import { NextRequest } from "next/server";
import { UPSTREAM, invalidId, proxyReportBuilder } from "../../_lib/proxy";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/report-builder/schedules/{id} */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return invalidId(id, "schedule id") ?? proxyReportBuilder(request, UPSTREAM.schedule(id), { method: "GET", search: "" });
}

/** PUT /api/report-builder/schedules/{id} — owner only; Data re-mints the schedule's token. */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return invalidId(id, "schedule id") ?? proxyReportBuilder(request, UPSTREAM.schedule(id), { method: "PUT", body: true, search: "" });
}

/** DELETE /api/report-builder/schedules/{id} — owner only. A 503 means the token could not be revoked. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return invalidId(id, "schedule id") ?? proxyReportBuilder(request, UPSTREAM.schedule(id), { method: "DELETE", search: "" });
}
