import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../../../_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/schedule/bulk/apply-template`, { method: "POST", forwardBody: true });
}
