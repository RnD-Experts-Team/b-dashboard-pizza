import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../../_lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; shiftId: string }> },
) {
  const { storeId, shiftId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/shifts/${encodeURIComponent(shiftId)}`, { method: "GET" });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; shiftId: string }> },
) {
  const { storeId, shiftId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/shifts/${encodeURIComponent(shiftId)}`, { method: "POST", forwardBody: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; shiftId: string }> },
) {
  const { storeId, shiftId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/shifts/${encodeURIComponent(shiftId)}`, { method: "DELETE" });
}
