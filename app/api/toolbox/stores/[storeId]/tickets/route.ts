import { NextRequest } from "next/server";
import {
  checkSegments,
  toolboxGet,
  toolboxPostRaw,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

type Params = { params: Promise<{ storeId: string }> };

/** One store's whole queue — NOT visibility-filtered (rows may carry viewer.can.view=false). */
export async function GET(request: NextRequest, { params }: Params) {
  const { storeId } = await params;
  const bad = checkSegments({ store: storeId });
  if (bad) return bad;
  return toolboxGet(request, `/stores/${encodeURIComponent(storeId)}/tickets`);
}

/** Raise a ticket — JSON, or multipart when files[] ride along. */
export async function POST(request: NextRequest, { params }: Params) {
  const { storeId } = await params;
  const bad = checkSegments({ store: storeId });
  if (bad) return bad;
  return toolboxPostRaw(request, `/stores/${encodeURIComponent(storeId)}/tickets`);
}
