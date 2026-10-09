import { NextRequest } from "next/server";
import { BASE_URL, proxyDelete, proxyJsonPut } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ id: string; issue: string }> };

/** A technician's rating on one catalog issue: replace it, or forget it. */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id, issue } = await params;
  return proxyJsonPut(request, `${BASE_URL}/technicians/${encodeURIComponent(id)}/abilities/${encodeURIComponent(issue)}`);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id, issue } = await params;
  return proxyDelete(request, `${BASE_URL}/technicians/${encodeURIComponent(id)}/abilities/${encodeURIComponent(issue)}`);
}
