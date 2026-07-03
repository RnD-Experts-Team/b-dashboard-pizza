import { NextRequest } from "next/server";
import { proxyInventory } from "../../_lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyInventory(request, `/inventory/items/${id}`, { method: "GET" });
}

// Update sends multipart with `_method=PUT` spoofed inside the body (Laravel
// can't parse a real multipart PUT), so the upstream method here is POST too.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyInventory(request, `/inventory/items/${id}`, {
    method: "POST",
    forwardBody: true,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyInventory(request, `/inventory/items/${id}`, {
    method: "DELETE",
  });
}
