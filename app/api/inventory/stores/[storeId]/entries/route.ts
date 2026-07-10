import { NextRequest } from "next/server";
import { proxyInventory } from "../../../_lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const { storeId } = await params;
  return proxyInventory(
    request,
    `/inventory/stores/${encodeURIComponent(storeId)}/entries`,
    { method: "GET" }
  );
}
