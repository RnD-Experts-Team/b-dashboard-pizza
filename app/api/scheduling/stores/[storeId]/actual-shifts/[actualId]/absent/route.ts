import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../../../_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; actualId: string }> },
) {
  const { storeId, actualId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/actual-shifts/${encodeURIComponent(actualId)}/absent`, { method: "POST", forwardBody: true });
}
