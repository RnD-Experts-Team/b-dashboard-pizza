import { NextRequest } from "next/server";
import { forward, invalidStoreKey } from "../../../_lib/route-utils";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ storeId: string }> };

/** GET /api/dough-sauce/stores/{storeId}/daily-plan → [data] /stores/{storeId}/dough-sauce/daily-plan */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { storeId } = await params;
  const invalid = invalidStoreKey(storeId);
  if (invalid) return invalid;
  return forward("data", request, `/stores/${encodeURIComponent(storeId)}/dough-sauce/daily-plan`, "GET");
}
