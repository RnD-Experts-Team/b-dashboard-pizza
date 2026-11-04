import { NextRequest } from "next/server";
import { UPSTREAM, invalidId, proxyReportBuilder } from "../../_lib/proxy";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/report-builder/templates/{id} */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return invalidId(id, "template id") ?? proxyReportBuilder(request, UPSTREAM.template(id), { method: "GET", search: "" });
}

/** PUT /api/report-builder/templates/{id} — owner only (Data checks owner_user_id). */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return invalidId(id, "template id") ?? proxyReportBuilder(request, UPSTREAM.template(id), { method: "PUT", body: true, search: "" });
}

/** DELETE /api/report-builder/templates/{id} — owner only. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return invalidId(id, "template id") ?? proxyReportBuilder(request, UPSTREAM.template(id), { method: "DELETE", search: "" });
}
