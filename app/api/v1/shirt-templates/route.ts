import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyMultipart } from "@/app/api/_lib/hiring-proxy";

/**
 * POST /api/v1/shirt-templates
 * Proxy → POST {HIRING}/v1/shirt-templates
 *
 * multipart/form-data: `name`, `svg`, `print_area` (a JSON STRING over
 * multipart), optional `gender` (omitted entirely for unisex), `is_default`,
 * `is_active`. The SVG is sanitized server-side on upload, which is what makes
 * it safe for the preview to inline it.
 */
export async function POST(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;

  return proxyMultipart(request, authorization, "/shirt-templates");
}
