import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../../../_lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; employeeId: string }> },
) {
  const { storeId, employeeId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/employees/${encodeURIComponent(employeeId)}/sync-status`, { method: "GET" });
}
