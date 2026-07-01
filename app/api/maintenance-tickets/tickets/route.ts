import { NextRequest } from "next/server";
import { BASE_URL, proxyGet, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const upstreamUrl = `${BASE_URL}/tickets${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  return proxyGet(request, upstreamUrl);
}

export async function POST(request: NextRequest) {
  return proxyRawPost(request, `${BASE_URL}/tickets`);
}
