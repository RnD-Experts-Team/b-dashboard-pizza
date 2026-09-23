import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../../_lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; publishedId: string }> },
) {
  const { storeId, publishedId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/published-schedules/${encodeURIComponent(publishedId)}`, { method: "GET" });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; publishedId: string }> },
) {
  const { storeId, publishedId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/published-schedules/${encodeURIComponent(publishedId)}`, { method: "DELETE" });
}
