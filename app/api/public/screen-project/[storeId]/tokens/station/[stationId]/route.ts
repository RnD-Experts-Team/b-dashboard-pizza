import { NextRequest, NextResponse } from "next/server";

const SCREEN_PROJECT_BASE_URL =
  process.env.SCREEN_PROJECT_BASE_URL ||
  process.env.NEXT_PUBLIC_SCREEN_PROJECT_BASE_URL ||
  "https://control.screens.lcportal.cloud/api";

const UPSTREAM_TIMEOUT_MS = 15_000;

/**
 * POST /api/public/screen-project/[storeId]/tokens/station/[stationId]
 * Public proxy — authenticated by station password in body, not user auth.
 * Forwards to POST {SCREEN_PROJECT_BASE_URL}/{storeId}/tokens/stations/{stationId}
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; stationId: string }> },
) {
  const { storeId, stationId } = await params;

  let rawBody: string;
  try {
    rawBody = await request.text();
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    if (!parsed.password || typeof parsed.password !== "string") {
      return NextResponse.json({ error: "password is required" }, { status: 400 });
    }
    // Only forward the expected field
    rawBody = JSON.stringify({ password: parsed.password });
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(
      `${SCREEN_PROJECT_BASE_URL}/${storeId}/tokens/stations/${stationId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: rawBody,
        signal: controller.signal,
      },
    );

    clearTimeout(timer);

    if (upstream.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

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
      return NextResponse.json({ error: "Upstream request timed out" }, { status: 504 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to reach screen project service: ${message}` },
      { status: 502 },
    );
  }
}
