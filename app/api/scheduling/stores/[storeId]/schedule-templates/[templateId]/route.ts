import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../../_lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; templateId: string }> },
) {
  const { storeId, templateId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/schedule-templates/${encodeURIComponent(templateId)}`, { method: "GET" });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; templateId: string }> },
) {
  const { storeId, templateId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/schedule-templates/${encodeURIComponent(templateId)}`, { method: "POST", forwardBody: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; templateId: string }> },
) {
  const { storeId, templateId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/schedule-templates/${encodeURIComponent(templateId)}`, { method: "DELETE" });
}
