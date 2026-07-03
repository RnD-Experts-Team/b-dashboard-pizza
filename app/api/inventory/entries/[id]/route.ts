import { NextRequest } from "next/server";
import { proxyInventory } from "../../_lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyInventory(request, `/inventory/entries/${id}`, {
    method: "GET",
  });
}
