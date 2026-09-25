import { NextRequest } from "next/server";
import { proxyToolbox, seg } from "@/app/api/toolbox/_lib/proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return proxyToolbox(request, `/breaks/${seg(id)}`, { method: "GET" });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return proxyToolbox(request, `/breaks/${seg(id)}`, { method: "POST", forwardBody: true });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return proxyToolbox(request, `/breaks/${seg(id)}`, { method: "DELETE" });
}
