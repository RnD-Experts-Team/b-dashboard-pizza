import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxPostRaw,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ storeId: string; ticketId: string }> };

/** { files[] } */
export async function POST(request: NextRequest, { params }: Params) {
  const { storeId, ticketId } = await params;
  const bad = checkSegments({ store: storeId, ids: [ticketId] });
  if (bad) return bad;
  return toolboxPostRaw(request, `/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/attachments`);
}
