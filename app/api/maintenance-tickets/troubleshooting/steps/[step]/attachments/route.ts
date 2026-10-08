import { NextRequest } from "next/server";
import { BASE_URL, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ step: string }> };

/** Add files (multipart files[]) to one step of a troubleshooting guide. */
export async function POST(request: NextRequest, { params }: Params) {
  const { step } = await params;
  return proxyRawPost(request, `${BASE_URL}/troubleshooting-steps/${encodeURIComponent(step)}/attachments`);
}
