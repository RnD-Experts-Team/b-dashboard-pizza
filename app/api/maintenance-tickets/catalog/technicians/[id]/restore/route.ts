import { NextRequest } from "next/server";
import { BASE_URL, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ id: string }> };

/** Brings a deleted technicians row back. */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyRawPost(request, `${BASE_URL}/technicians/${encodeURIComponent(id)}/restore`);
}
