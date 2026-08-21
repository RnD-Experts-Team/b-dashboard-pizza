import { NextRequest } from "next/server";
import {
  CLEANING_BASE_URL,
  errorResponse,
  forwardJson,
  getHeaders,
  jsonHeaders,
  requireAuthorization,
} from "../_lib/route-utils";

export const dynamic = "force-dynamic";

/** GET /api/cleaning/evaluations?period_type=&period_key= — the grid */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const search = request.nextUrl.search;
  return forwardJson(`${CLEANING_BASE_URL}/evaluations${search}`, {
    method: "GET",
    headers: getHeaders(request),
  });
}

/**
 * POST /api/cleaning/evaluations — set one cell (kind: item | chart)
 *
 * Chart cells arrive as JSON (quick toggle). Item cells arrive as
 * multipart/form-data because they carry a note + images[]; those are rebuilt
 * into a fresh FormData and forwarded WITHOUT a Content-Type so fetch
 * generates the multipart boundary.
 */
export async function POST(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let incoming: FormData;
    try {
      incoming = await request.formData();
    } catch {
      return errorResponse("INVALID_PARAM", "Invalid form data in request body.", 400);
    }

    const upstream = new FormData();
    for (const field of [
      "store_id",
      "period_type",
      "period_key",
      "kind",
      "inspection_item_id",
      "value",
      "note",
    ]) {
      const val = incoming.get(field);
      if (typeof val === "string" && val !== "") upstream.append(field, val);
    }
    for (const file of incoming.getAll("images[]")) {
      if (file instanceof File && file.size > 0) {
        upstream.append("images[]", file, file.name || "image.jpg");
      }
    }

    return forwardJson(`${CLEANING_BASE_URL}/evaluations`, {
      method: "POST",
      headers: getHeaders(request),
      body: upstream,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_PARAM", "Invalid JSON in request body.", 400);
  }

  return forwardJson(`${CLEANING_BASE_URL}/evaluations`, {
    method: "POST",
    headers: jsonHeaders(request),
    body: JSON.stringify(body),
  });
}
