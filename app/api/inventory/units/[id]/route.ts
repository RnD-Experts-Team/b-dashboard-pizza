import { NextRequest } from "next/server";
import { proxyInventory } from "../../_lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyInventory(request, `/inventory/units/${id}`, { method: "GET" });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyInventory(request, `/inventory/units/${id}`, {
    method: "PUT",
    forwardBody: true,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyInventory(request, `/inventory/units/${id}`, {
    method: "DELETE",
  });
}
