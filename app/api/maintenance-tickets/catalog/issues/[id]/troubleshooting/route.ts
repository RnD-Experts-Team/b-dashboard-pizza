import { NextRequest } from "next/server";
import { BASE_URL, proxyDelete, proxyGet, proxyJsonPut } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ id: string }> };

/** One catalog issue's troubleshooting guide: read, replace (new version), remove. */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyGet(request, `${BASE_URL}/issues/${encodeURIComponent(id)}/troubleshooting`);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyJsonPut(request, `${BASE_URL}/issues/${encodeURIComponent(id)}/troubleshooting`);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyDelete(request, `${BASE_URL}/issues/${encodeURIComponent(id)}/troubleshooting`);
}
