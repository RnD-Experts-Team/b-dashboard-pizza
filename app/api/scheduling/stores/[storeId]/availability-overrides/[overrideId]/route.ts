import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../../_lib/proxy";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; overrideId: string }> },
) {
  const { storeId, overrideId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/availability-overrides/${encodeURIComponent(overrideId)}`, { method: "DELETE" });
}
