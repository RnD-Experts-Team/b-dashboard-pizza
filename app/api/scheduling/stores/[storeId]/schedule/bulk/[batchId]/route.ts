import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../../../_lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; batchId: string }> },
) {
  const { storeId, batchId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/schedule/bulk/${encodeURIComponent(batchId)}`, { method: "GET" });
}
