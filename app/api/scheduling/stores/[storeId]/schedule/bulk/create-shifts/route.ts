import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../../../_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/schedule/bulk/create-shifts`, { method: "POST", forwardBody: true });
}
