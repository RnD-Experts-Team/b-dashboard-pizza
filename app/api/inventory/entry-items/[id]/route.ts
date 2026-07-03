import { NextRequest } from "next/server";
import { proxyInventory } from "../../_lib/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyInventory(request, `/inventory/entry-items/${id}`, {
    method: "PATCH",
    forwardBody: true,
  });
}
