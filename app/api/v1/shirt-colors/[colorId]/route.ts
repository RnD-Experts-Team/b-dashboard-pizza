import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import {
  HIRING_BASE_URL,
  proxyFetch,
  proxyJson,
} from "@/app/api/_lib/hiring-proxy";

function path(colorId: string) {
  return `/shirt-colors/${encodeURIComponent(colorId)}`;
}

/**
 * PUT /api/v1/shirt-colors/[colorId]
 * Proxy → PUT {HIRING}/v1/shirt-colors/{id}
 *
 * A genuine partial update — any subset of the fields. Colours are the only
 * catalog entity that patches; logos and templates update via POST with the
 * full payload, because their request classes key "required" off isMethod('POST').
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ colorId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { colorId } = await params;

  return proxyJson(request, authorization, path(colorId), "PUT");
}

/**
 * DELETE /api/v1/shirt-colors/[colorId]
 *
 * Deactivates rather than removes — past milestones still reference the row.
 * Returns 204 with no body, which proxyFetch handles.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ colorId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { colorId } = await params;

  return proxyFetch(`${HIRING_BASE_URL}/v1${path(colorId)}`, {
    method: "DELETE",
    headers: { Authorization: authorization, Accept: "application/json" },
  });
}
