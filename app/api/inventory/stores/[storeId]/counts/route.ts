import { NextRequest } from "next/server";
import { proxyInventory } from "../../../_lib/proxy";

/**
 * GET /api/inventory/stores/{storeId}/counts?date_from=&date_to=&ultimatrix_ids=&all_entries=
 * Counted quantities for a date range × items (Dough & Sauce contract §5).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const { storeId } = await params;
  return proxyInventory(
    request,
    `/inventory/stores/${encodeURIComponent(storeId)}/counts`,
    { method: "GET" }
  );
}
