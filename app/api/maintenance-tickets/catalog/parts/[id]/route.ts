import { NextRequest } from "next/server";
import { BASE_URL, proxyDelete, proxyGet, proxyJsonPatch } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ id: string }> };

const upstream = (id: string) => `${BASE_URL}/parts/${encodeURIComponent(id)}`;

/** One parts row: read, edit in place (only the fields sent change), delete. */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyGet(request, upstream(id));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyJsonPatch(request, upstream(id));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyDelete(request, upstream(id));
}
