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

  const tempId = formData.get("temp_id");
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);
  const mappingsField = formData.get("mappings");

  if (typeof mappingsField !== "string" || !mappingsField.trim()) {
    return errorResponse("VALIDATION_ERROR", "mappings is required and must be a valid JSON object.", 422, {
      field: "mappings",
    });
  }

  let parsedMappings: unknown;
  try {
    parsedMappings = JSON.parse(mappingsField);
  } catch {
    return errorResponse(
      "VALIDATION_ERROR",
      "mappings must be valid JSON (object).",
      422,
      { field: "mappings" }
    );
  }

  if (!parsedMappings || typeof parsedMappings !== "object" || Array.isArray(parsedMappings)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "mappings must be a JSON object.",
      422,
      { field: "mappings" }
    );
  }

  if (files.length === 0 && (typeof tempId !== "string" || !tempId.trim())) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Either files or temp_id is required.",
      422,
      { fields: ["files", "temp_id"] }
    );
  }

  const upstreamFormData = new FormData();
  
  for (const file of files) {
    // Ensure filename is preserved when passing to the upstream fetch
    upstreamFormData.append("files", file, file.name || "upload.csv");
    // Also send as files[] in case the upstream API expects PHP/Laravel array conventions
    upstreamFormData.append("files[]", file, file.name || "upload.csv");
  }

  // Forward the mappings exact JSON string, as the API expects an object structure (e.g. {"file1.csv": "detail_orders"})
  upstreamFormData.append("mappings", mappingsField);

  if (typeof tempId === "string" && tempId.trim()) {
    upstreamFormData.append("temp_id", tempId);
  }

  const targetUrl = `${DATA_BASE_URL}/manual-import/upload`;

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
