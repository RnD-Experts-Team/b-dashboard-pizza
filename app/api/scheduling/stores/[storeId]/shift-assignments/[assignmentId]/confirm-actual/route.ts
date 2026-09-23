import { NextRequest } from "next/server";
import { proxyScheduling } from "../../../../../_lib/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; assignmentId: string }> },
) {
  const { storeId, assignmentId } = await params;
  return proxyScheduling(request, `/stores/${encodeURIComponent(storeId)}/shift-assignments/${encodeURIComponent(assignmentId)}/confirm-actual`, { method: "POST", forwardBody: true });
}
