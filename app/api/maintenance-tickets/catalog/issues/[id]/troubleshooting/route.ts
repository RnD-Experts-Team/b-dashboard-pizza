import { NextRequest } from "next/server";
import { BASE_URL, proxyGet, proxyJsonPost } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ id: string }> };

/** One catalog issue and all its troubleshooting guides -- the issue's troubleshooting page. */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyGet(request, `${BASE_URL}/issues/${encodeURIComponent(id)}/troubleshooting`);
}

/** Add a guide to the issue (one per specific problem). */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyJsonPost(request, `${BASE_URL}/issues/${encodeURIComponent(id)}/troubleshooting-guides`);
}
