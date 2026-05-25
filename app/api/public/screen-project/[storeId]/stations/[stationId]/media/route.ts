import { NextRequest, NextResponse } from "next/server";

const SCREEN_PROJECT_BASE_URL =
  process.env.SCREEN_PROJECT_BASE_URL ||
  process.env.NEXT_PUBLIC_SCREEN_PROJECT_BASE_URL ||
  "https://control.screens.lcportal.cloud/api";

const UPSTREAM_TIMEOUT_MS = 15_000;

/**
 * GET /api/public/screen-project/[storeId]/stations/[stationId]/media
 * Public proxy — no supervisor auth required.
 * Used by the station screen (public-screen-view) to load the primary media
 * fallback shown when the supervisor's camera is off.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ storeId: string; stationId: string }> },
) {
  const { storeId, stationId } = await params;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(
      `${SCREEN_PROJECT_BASE_URL}/${storeId}/stations/${stationId}/media`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      },
    );

    clearTimeout(timer);

    const body = await upstream.text();

    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json({ error: "Upstream timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 502 });
  }
}
