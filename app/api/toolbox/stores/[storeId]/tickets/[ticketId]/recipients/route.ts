import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxGet,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ storeId: string; ticketId: string }> };

/** Routing debug: candidates (before the store filter) vs user_ids (who receives). */
export async function GET(request: NextRequest, { params }: Params) {
  const { storeId, ticketId } = await params;
  const bad = checkSegments({ store: storeId, ids: [ticketId] });
  if (bad) return bad;
  return toolboxGet(request, `/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/recipients`);
}
