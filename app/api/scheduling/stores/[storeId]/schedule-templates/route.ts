import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../_lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/schedule-templates`, { method: "GET" });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/schedule-templates`, { method: "POST", forwardBody: true });
}
