import { NextRequest } from "next/server";
import { forward, invalidStoreKey } from "../../../_lib/route-utils";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ storeId: string }> };

/** PUT /api/dough-sauce/stores/{storeId}/judgement → [audit] /stores/{storeId}/dough-sauce/judgement */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { storeId } = await params;
  const invalid = invalidStoreKey(storeId);
  if (invalid) return invalid;
  return forward("audit", request, `/stores/${encodeURIComponent(storeId)}/dough-sauce/judgement`, "PUT");
}
