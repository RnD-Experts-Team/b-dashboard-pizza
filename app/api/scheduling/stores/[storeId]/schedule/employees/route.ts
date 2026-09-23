import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../../_lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/schedule/employees`, { method: "GET" });
}
