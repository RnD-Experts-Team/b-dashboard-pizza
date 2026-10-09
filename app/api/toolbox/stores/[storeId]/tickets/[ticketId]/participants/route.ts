import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxGet,
  toolboxPost,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ storeId: string; ticketId: string }> };

/** List participants. */
export async function GET(request: NextRequest, { params }: Params) {
  const { storeId, ticketId } = await params;
  const bad = checkSegments({ store: storeId, ids: [ticketId] });
  if (bad) return bad;
  return toolboxGet(request, `/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/participants`);
}

/** { user_id, role } — re-adding changes the role. */
export async function POST(request: NextRequest, { params }: Params) {
  const { storeId, ticketId } = await params;
  const bad = checkSegments({ store: storeId, ids: [ticketId] });
  if (bad) return bad;
  return toolboxPost(request, `/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/participants`);
}
