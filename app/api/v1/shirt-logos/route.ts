import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyMultipart } from "@/app/api/_lib/hiring-proxy";

/**
 * POST /api/v1/shirt-logos
 * Proxy → POST {HIRING}/v1/shirt-logos
 *
 * multipart/form-data: `name`, `file` (SVG or PNG, ≤2 MB), optional
 * `is_active` / `sort_order`. Logos are stored exactly as uploaded — they never
 * change colour, so nothing converts between formats.
 */
export async function POST(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;

  return proxyMultipart(request, authorization, "/shirt-logos");
}
