import { NextResponse } from "next/server";

/**
 * GET /{locale}/store/{storeNumber}/stations/manifest.webmanifest
 * Per-store manifest so `start_url`/`scope` can point at this exact store's
 * station page — a shared static manifest can't do that, since the Web App
 * Manifest spec resolves relative start_url/scope against the manifest
 * file's own URL, not the page that linked to it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; storeNumber: string }> },
) {
  const { locale, storeNumber } = await params;
  const stationUrl = `/${locale}/store/${storeNumber}/stations`;

  return NextResponse.json(
    {
      id: `pizza-dashboard-station-${storeNumber}`,
      name: "Pizza Dashboard — Station",
      short_name: "Station",
      description: "Live station camera/audio for the Screen Project system.",
      start_url: stationUrl,
      scope: "/",
      display: "standalone",
      orientation: "landscape",
      background_color: "#0a0a0a",
      theme_color: "#0a0a0a",
      icons: [{ src: "/logo.svg", sizes: "any", type: "image/svg+xml" }],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
