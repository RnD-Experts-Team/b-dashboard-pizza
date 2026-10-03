import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxGet,
  toolboxPost,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ storeId: string; ticketId: string }> };

/** The full ticket — the only read that carries the whole thread. */
export async function GET(request: NextRequest, { params }: Params) {
  const { storeId, ticketId } = await params;
  const bad = checkSegments({ store: storeId, ids: [ticketId] });
  if (bad) return bad;
  return toolboxGet(request, `/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}`);
}

/** Edit title / description / section_key (partial). */
export async function POST(request: NextRequest, { params }: Params) {
  const { storeId, ticketId } = await params;
  const bad = checkSegments({ store: storeId, ids: [ticketId] });
  if (bad) return bad;
  return toolboxPost(request, `/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}`);
}
