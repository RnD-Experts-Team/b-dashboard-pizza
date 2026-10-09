import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxDelete,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ storeId: string; ticketId: string; userId: string }> };

/** Silent upstream — no notification, no broadcast. Refetch after. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { storeId, ticketId, userId } = await params;
  const bad = checkSegments({ store: storeId, ids: [ticketId, userId] });
  if (bad) return bad;
  return toolboxDelete(request, `/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/participants/${userId}`);
}
