import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import {
  HIRING_BASE_URL,
  proxyFetch,
  proxyMultipart,
} from "@/app/api/_lib/hiring-proxy";

function path(templateId: string) {
  return `/shirt-templates/${encodeURIComponent(templateId)}`;
}

/**
 * POST /api/v1/shirt-templates/[templateId] — the UPDATE verb, not PUT.
 * Proxy → POST {HIRING}/v1/shirt-templates/{id}
 *
 * Same rule as logos: the upstream request class treats any POST as a create,
 * so `name`, `svg` and `print_area` are all required again on an edit.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { templateId } = await params;

  return proxyMultipart(request, authorization, path(templateId));
}

/**
 * DELETE /api/v1/shirt-templates/[templateId] — deactivates, returns 204.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { templateId } = await params;

  return proxyFetch(`${HIRING_BASE_URL}/v1${path(templateId)}`, {
    method: "DELETE",
    headers: { Authorization: authorization, Accept: "application/json" },
  });
}
