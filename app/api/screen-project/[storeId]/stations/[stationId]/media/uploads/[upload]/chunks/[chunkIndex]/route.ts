import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  errorResponse,
} from "@/app/api/_lib/auth";

const SCREEN_PROJECT_BASE_URL =
  process.env.SCREEN_PROJECT_BASE_URL ||
  process.env.NEXT_PUBLIC_SCREEN_PROJECT_BASE_URL ||
  "https://control.screens.lcportal.cloud/api";

// Only the hop from this server to Screens; the browser's own upload is
// over by then (the body is read first).
const UPSTREAM_TIMEOUT_MS = 120_000;

/**
 * POST /api/screen-project/[storeId]/stations/[stationId]/media/uploads/[upload]/chunks/[chunkIndex]
 * Body: multipart/form-data, field "chunk" (binary)
 * Proxy → POST {SCREEN_PROJECT_BASE_URL}/{storeId}/stations/{stationId}/media/uploads/{upload}/chunks/{chunkIndex}
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      storeId: string;
      stationId: string;
      upload: string;
      chunkIndex: string;
    }>;
  },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId, stationId, upload, chunkIndex } = await params;

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return errorResponse("VALIDATION_ERROR", "Expected multipart/form-data body", 400);
  }

  // Forward the multipart bytes as they came (the boundary is in the
  // Content-Type): no parsing and rebuilding the form for every chunk.
  let body: ArrayBuffer;
  try {
    body = await request.arrayBuffer();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Could not read the chunk body", 400);
  }

  const path = [storeId, "stations", stationId, "media", "uploads", upload, "chunks", chunkIndex]
    .map(encodeURIComponent)
    .join("/");

  try {
    const upstream = await fetch(`${SCREEN_PROJECT_BASE_URL}/${path}`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        Accept: "application/json",
        "Content-Type": contentType,
      },
      body,
      // Stop when the browser gives up on this chunk (it will retry it).
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
    });

    if (upstream.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const responseBody = await upstream.text();

    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return errorResponse("TIMEOUT", "Chunk upload timed out", 504);
    }
    return errorResponse(
      "UPSTREAM_ERROR",
      "Failed to reach screen project service",
      502,
    );
  }
}
