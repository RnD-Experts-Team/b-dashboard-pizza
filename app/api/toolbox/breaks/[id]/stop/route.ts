import { NextRequest } from "next/server";
import { proxyToolbox, seg } from "@/app/api/toolbox/_lib/proxy";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToolbox(request, `/breaks/${seg(id)}/stop`, { method: "POST" });
}
