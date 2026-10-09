import { NextRequest } from "next/server";
import { BASE_URL, proxyJsonPost } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ store: string }> };

/** "This fixed it": troubleshooting solved the problem at this store -- logged, no ticket. */
export async function POST(request: NextRequest, { params }: Params) {
  const { store } = await params;
  return proxyJsonPost(request, `${BASE_URL}/stores/${encodeURIComponent(store)}/troubleshooting-fixes`);
}
