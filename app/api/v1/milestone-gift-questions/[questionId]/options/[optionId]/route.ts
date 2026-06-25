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

const UPSTREAM_TIMEOUT_MS =
  Number(process.env.HIRING_TIMEOUT_MS) || 15_000;

function upstreamUrl(questionId: string, optionId: string) {
  return `${HIRING_BASE_URL}/v1/milestone-gift-questions/${questionId}/options/${optionId}`;
}

async function proxyFetch(url: string, init: RequestInit): Promise<NextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);

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
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorResponse("UPSTREAM_ERROR", "Failed to reach hiring service", 502);
  }
}

/**
 * PUT    /api/v1/milestone-gift-questions/[questionId]/options/[optionId]  → update option
 * DELETE /api/v1/milestone-gift-questions/[questionId]/options/[optionId]  → delete option
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string; optionId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { questionId, optionId } = await params;
  const body = await request.text();

  return proxyFetch(upstreamUrl(questionId, optionId), {
    method: "PUT",
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string; optionId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { questionId, optionId } = await params;

  return proxyFetch(upstreamUrl(questionId, optionId), {
    method: "DELETE",
    headers: { Authorization: authorization, Accept: "application/json" },
  });
}
