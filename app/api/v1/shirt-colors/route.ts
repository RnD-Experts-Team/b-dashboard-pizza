import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyJson } from "@/app/api/_lib/hiring-proxy";

/**
 * POST /api/v1/shirt-colors
 * Proxy → POST {HIRING}/v1/shirt-colors
 *
 * JSON `{ name, hex_code, is_active?, sort_order? }`. `hex_code` accepts 3- or
 * 6-digit hex with or without "#" and comes back normalised to uppercase
 * #RRGGBB, so read the response rather than trusting what was sent.
 */
export async function POST(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;

  return proxyJson(request, authorization, "/shirt-colors", "POST");
}
