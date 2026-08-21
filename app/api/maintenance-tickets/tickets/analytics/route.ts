import { NextRequest } from "next/server";
import { BASE_URL, proxyGet } from "@/app/api/maintenance-tickets/_lib/proxy";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const upstreamUrl = `${BASE_URL}/tickets/analytics${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  return proxyGet(request, upstreamUrl);
}
