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

  const mappings = formData.get("mappings");
  const tempId = formData.get("temp_id");
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (typeof mappings !== "string" || !mappings.trim()) {
    return errorResponse("VALIDATION_ERROR", "mappings is required.", 422, {
      field: "mappings",
    });
  }

  // Ensure mappings are forwarded as an array (upstream expects an array).
  // We'll append one `mappings[]` form entry per mapping item.
  let parsedMappings: unknown;
  try {
    parsedMappings = JSON.parse(mappings);
  } catch {
    return errorResponse(
      "VALIDATION_ERROR",
      "mappings must be valid JSON (object or array).",
      422,
      { field: "mappings" }
    );
  }

  const appendMappingEntry = (item: unknown) => {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      upstreamFormData.append("mappings[]", String(item));
    } else {
      upstreamFormData.append("mappings[]", JSON.stringify(item));
    }
  };

  if (Array.isArray(parsedMappings)) {
    for (const item of parsedMappings) appendMappingEntry(item);
  } else if (parsedMappings && typeof parsedMappings === "object") {
    for (const [filename, mapTo] of Object.entries(parsedMappings as Record<string, unknown>)) {
      appendMappingEntry({ filename, mapping: mapTo });
    }
  } else {
    return errorResponse(
      "VALIDATION_ERROR",
      "mappings must be an object or array.",
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
    upstreamFormData.append("files[]", file);
  }
  // `mappings[]` entries already appended above
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
