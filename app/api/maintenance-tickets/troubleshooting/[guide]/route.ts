import { NextRequest } from "next/server";
import { BASE_URL, proxyDelete, proxyJsonPut } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ guide: string }> };

/** Replace a troubleshooting guide (a new version). */
export async function PUT(request: NextRequest, { params }: Params) {
  const { guide } = await params;
  return proxyJsonPut(request, `${BASE_URL}/troubleshooting-guides/${encodeURIComponent(guide)}`);
}

/** Remove a troubleshooting guide. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { guide } = await params;
  return proxyDelete(request, `${BASE_URL}/troubleshooting-guides/${encodeURIComponent(guide)}`);
}
