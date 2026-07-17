import { NextRequest } from "next/server";
import { proxyInventory } from "../../../_lib/proxy";

// Toggle an item's active state. Forwards the JSON `{ is_active }` body upstream.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyInventory(request, `/inventory/items/${id}/active`, {
    method: "PATCH",
    forwardBody: true,
  });
}
