import { NextRequest } from "next/server";
import { BASE_URL, proxyRawPost } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ guide: string }> };

/** Add files (multipart files[]) to a troubleshooting guide. */
export async function POST(request: NextRequest, { params }: Params) {
  const { guide } = await params;
  return proxyRawPost(request, `${BASE_URL}/troubleshooting-guides/${encodeURIComponent(guide)}/attachments`);
}
