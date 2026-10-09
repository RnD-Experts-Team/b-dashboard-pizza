import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxPost,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ storeId: string; ticketId: string }> };

/** { reason } — required. */
export async function POST(request: NextRequest, { params }: Params) {
  const { storeId, ticketId } = await params;
  const bad = checkSegments({ store: storeId, ids: [ticketId] });
  if (bad) return bad;
  return toolboxPost(request, `/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/reopen`);
}
