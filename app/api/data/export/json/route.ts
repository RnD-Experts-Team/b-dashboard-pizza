import { NextRequest, NextResponse } from "next/server";
import {
  DATA_BASE_URL,
  MAX_RETRIES,
  UPSTREAM_TIMEOUT_MS,
  errorResponse,
  fetchWithRetry,
  getUpstreamAuth,
  handleFetchError,
  handleUpstreamError,
  validateAuth,
} from "../../manual-import/_lib/route-utils";

export async function GET(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const model = searchParams.get("model");
  const store = searchParams.get("store");

  if (!model) {
    return errorResponse("VALIDATION_ERROR", "model parameter is required.", 422, {
      field: "model",
    });
  }

  const query = new URLSearchParams();
  query.append("model", model);
  if (start) query.append("start", start);
  if (end) query.append("end", end);
  if (store) query.append("store", store);

  const targetUrl = `${DATA_BASE_URL}/export/json?${query.toString()}`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: getUpstreamAuth(request),
        },
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    if (response.ok) {
      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      
      const headers = new Headers();
      headers.set("Content-Type", response.headers.get("Content-Type") || "application/json");
      headers.set("Cache-Control", "no-store");
      
      if (contentDisposition) {
        headers.set("Content-Disposition", contentDisposition);
      } else {
        headers.set("Content-Disposition", `attachment; filename="export-${model}.json"`);
      }

      return new NextResponse(blob, {
        status: 200,
        headers,
      });
    }

    return await handleUpstreamError(response);
  } catch (error) {
    return handleFetchError(error);
  }
}
