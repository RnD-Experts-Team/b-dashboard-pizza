import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import {
  HIRING_BASE_URL,
  proxyFetch,
  proxyMultipart,
} from "@/app/api/_lib/hiring-proxy";

function path(logoId: string) {
  return `/shirt-logos/${encodeURIComponent(logoId)}`;
}

/**
 * POST /api/v1/shirt-logos/[logoId] — the UPDATE verb, not PUT.
 * Proxy → POST {HIRING}/v1/shirt-logos/{id}
 *
 * POST so a file can ride on multipart. The catch: the upstream request class
 * treats any POST as a create, so `name` and `file` are BOTH required again on
 * an edit. There is no partial update; the form re-uploads.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ logoId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { logoId } = await params;

  return proxyMultipart(request, authorization, path(logoId));
}

/**
 * DELETE /api/v1/shirt-logos/[logoId] — deactivates, returns 204 null body.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ logoId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { logoId } = await params;

  return proxyFetch(`${HIRING_BASE_URL}/v1${path(logoId)}`, {
    method: "DELETE",
    headers: { Authorization: authorization, Accept: "application/json" },
  });
}
