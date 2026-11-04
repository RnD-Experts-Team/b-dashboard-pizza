import { NextRequest, NextResponse } from "next/server";
import {
  getAuthorizationHeader,
  errorResponse,
  fetchWithTimeout,
} from "@/app/api/_lib/auth";

const MS_PER_SECOND = 1000;
const DEFAULT_TIMEOUT_SECONDS = 300;
const HTTP_GATEWAY_TIMEOUT = 504;
const HTTP_BAD_GATEWAY = 502;

/** Business Reports wait as long as a big range needs (default 5 min). */
export const BUSINESS_REPORTS_TIMEOUT_MS =
  Number(process.env.BUSINESS_REPORTS_TIMEOUT_MS) ||
  DEFAULT_TIMEOUT_SECONDS * MS_PER_SECOND;

/**
 * Forwards a Business Reports request upstream with the USER's own token —
 * pizzasys then checks every requested store against that user's auth rule —
 * and mirrors the status and body.
 */
export async function proxyBusinessReport(
  request: NextRequest,
  upstreamUrl: string,
  serviceName: string,
  init: { method: "GET" | "POST"; body?: string },
): Promise<NextResponse> {
  try {
    const upstream = await fetchWithTimeout(
      upstreamUrl,
      {
        method: init.method,
        headers: {
          Authorization: getAuthorizationHeader(request)!,
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body,
        cache: "no-store",
      },
      BUSINESS_REPORTS_TIMEOUT_MS,
      request.signal,
    );

    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return errorResponse(
        "TIMEOUT",
        `The ${serviceName} did not answer within ${BUSINESS_REPORTS_TIMEOUT_MS / MS_PER_SECOND}s.`,
        HTTP_GATEWAY_TIMEOUT,
      );
    }
    return errorResponse("UPSTREAM_ERROR", `Failed to reach the ${serviceName}`, HTTP_BAD_GATEWAY);
  }
}
