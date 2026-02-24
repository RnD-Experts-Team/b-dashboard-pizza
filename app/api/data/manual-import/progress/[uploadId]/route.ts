import { NextRequest } from "next/server";
import {
  DATA_BASE_URL,
  MAX_RETRIES,
  UPSTREAM_TIMEOUT_MS,
  errorResponse,
  fetchWithRetry,
  getUpstreamAuth,
  handleFetchError,
  handleUpstreamError,
  proxyJsonResponse,
  validateAuth,
} from "../../_lib/route-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const authError = validateAuth(request);
  if (authError) return authError;

  const { uploadId } = await params;
  if (!uploadId?.trim()) {
    return errorResponse("INVALID_PARAM", "uploadId is required.", 400, {
      field: "uploadId",
    });
  }

  const targetUrl = `${DATA_BASE_URL}/manual-import/progress/${encodeURIComponent(uploadId)}`;

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
      const responseText = await response.text();
      return proxyJsonResponse(responseText, response.status);
    }

    return await handleUpstreamError(response);
  } catch (error) {
    return handleFetchError(error);
  }
}
