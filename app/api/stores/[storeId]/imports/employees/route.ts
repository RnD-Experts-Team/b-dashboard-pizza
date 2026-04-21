import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  errorResponse,
} from "@/app/api/_lib/auth";

const HIRING_BASE_URL =
  process.env.HIRING_API_URL ||
  process.env.NEXT_PUBLIC_HIRING_API_URL ||
  "https://hiring.lcportal.cloud/api";

const IMPORT_TIMEOUT_MS =
  Number(process.env.HIRING_IMPORT_TIMEOUT_MS) ||
  Number(process.env.HIRING_TIMEOUT_MS) ||
  120_000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid multipart form data.", 422);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse("VALIDATION_ERROR", "file is required.", 422, {
      field: "file",
    });
  }

  const upstreamFormData = new FormData();
  upstreamFormData.append("file", file, file.name || "employees-import.csv");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);

    const upstream = await fetch(
      `${HIRING_BASE_URL}/stores/${encodeURIComponent(storeId)}/imports/employees`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          Accept: "application/json",
        },
        body: upstreamFormData,
        signal: controller.signal,
      },
    );

    clearTimeout(timer);

    const responseBody = await upstream.text();

    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorResponse("UPSTREAM_ERROR", "Failed to reach hiring service", 502);
  }
}
