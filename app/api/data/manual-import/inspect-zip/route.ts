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
} from "../_lib/route-utils";

export async function POST(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("INVALID_PARAM", "Invalid form data in request body.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse("VALIDATION_ERROR", "file is required.", 422, {
      field: "file",
    });
  }

  const upstreamFormData = new FormData();
  upstreamFormData.append("file", file);

  const targetUrl = `${DATA_BASE_URL}/manual-import/inspect-zip`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: getUpstreamAuth(request),
        },
        body: upstreamFormData,
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
