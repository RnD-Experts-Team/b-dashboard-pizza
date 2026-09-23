import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../../_lib/proxy";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; timeOffId: string }> },
) {
  const { storeId, timeOffId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/time-off/${encodeURIComponent(timeOffId)}`, { method: "DELETE" });
}
