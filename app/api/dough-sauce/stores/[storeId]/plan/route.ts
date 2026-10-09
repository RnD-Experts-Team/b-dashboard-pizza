import { NextRequest } from "next/server";
import { forward, invalidStoreKey } from "../../../_lib/route-utils";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ storeId: string }> };

/** GET /api/dough-sauce/stores/{storeId}/plan → [audit] /stores/{storeId}/dough-sauce/plan */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { storeId } = await params;
  const invalid = invalidStoreKey(storeId);
  if (invalid) return invalid;
  return forward("audit", request, `/stores/${encodeURIComponent(storeId)}/dough-sauce/plan`, "GET");
}

/** POST /api/dough-sauce/stores/{storeId}/plan → [audit] /stores/{storeId}/dough-sauce/plan */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { storeId } = await params;
  const invalid = invalidStoreKey(storeId);
  if (invalid) return invalid;
  return forward("audit", request, `/stores/${encodeURIComponent(storeId)}/dough-sauce/plan`, "POST");
}
